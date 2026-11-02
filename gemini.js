const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const API        = 'https://generativelanguage.googleapis.com/v1beta/models/'
const TEXT_MODEL = 'gemini-flash-lite-latest'
const TTS_MODEL  = 'gemini-3.8-flash-tts'
const VOICE      = 'Laomedeia'
const TTS_GAP_MS = 21000   // el nivel gratis de voz permite ~3 frases por minuto
// Estilo de la voz del DJ (la instrucción se lee, el texto se actúa)
const VOICE_STYLE = 'Habla como una locutora de radio mexicana joven, cálida y carismática, platicando con un amigo: ' +
  'con emoción, sonrisas en la voz, pausas naturales y una risita ligera donde quede. Acento mexicano, relajado, nada formal. Di esto:'

const sleep = ms => new Promise(r => setTimeout(r, ms))

function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def }
}

// Cliente de Gemini (nivel gratis): texto para el "cerebro" del DJ y voz (TTS)
module.exports = function createGemini(dir) {
  const SETTINGS_PATH = path.join(dir, 'gemini.json')
  const VOICE_DIR     = path.join(dir, 'dj-voice')
  const settings = readJson(SETTINGS_PATH, {})
  let ttsChain = Promise.resolve()
  let lastTts  = 0

  async function request(model, body, key = settings.key) {
    let res
    try {
      res = await fetch(API + model + ':generateContent', {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      })
    } catch {
      throw new Error('network')
    }
    const j = await res.json().catch(() => ({}))
    if (j.error) {
      if (j.error.code === 429) throw new Error('quota')
      if (j.error.code === 400 || j.error.code === 401 || j.error.code === 403) throw new Error('invalid-key')
      throw new Error('network')
    }
    return j
  }

  // Frase → archivo de audio. Se guarda en caché: lo que ya se dijo una vez no gasta otra vez.
  function say(text) {
    const file = path.join(VOICE_DIR, crypto.createHash('sha1').update(VOICE + VOICE_STYLE + text).digest('hex') + '.wav')
    if (fs.existsSync(file)) return Promise.resolve(file)
    const run = ttsChain.then(async () => {
      if (fs.existsSync(file)) return file
      const wait = lastTts + TTS_GAP_MS - Date.now()
      if (wait > 0) await sleep(wait)
      lastTts = Date.now()
      const j = await request(TTS_MODEL, {
        contents: [{ parts: [{ text: `${VOICE_STYLE}\n${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
      })
      const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
      if (!part) throw new Error('network')
      let data = Buffer.from(part.inlineData.data, 'base64')
      if (!/wav/.test(part.inlineData.mimeType)) data = pcmToWav(data, +(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] || 24000))
      fs.mkdirSync(VOICE_DIR, { recursive: true })
      fs.writeFileSync(file, data)
      return file
    })
    ttsChain = run.catch(() => {})
    return run
  }

  // Texto (o JSON si se pasa un schema)
  async function think(system, prompt, schema) {
    const j = await request(TEXT_MODEL, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: schema
        ? { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.9 }
        : { temperature: 1 },
    })
    const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
    if (!text) throw new Error('network')
    return schema ? JSON.parse(text) : text
  }

  return {
    hasKey: () => !!settings.key,

    async setKey(key) {
      key = String(key || '').trim()
      if (key) {
        try { await request(TEXT_MODEL, { contents: [{ parts: [{ text: 'Responde sólo: ok' }] }] }, key) }
        catch (e) {
          return { ok: false, error: e.message === 'invalid-key' ? 'La API key de Gemini no es válida.' : 'No se pudo conectar con Gemini. Revisa tu internet.' }
        }
        settings.key = key
      } else {
        delete settings.key
      }
      try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings)) } catch {}
      return { ok: true }
    },

    say, think,
  }
}

function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}
