const fs        = require('fs')
const path      = require('path')
const crypto    = require('crypto')
const WebSocket = require('ws')

const API        = 'https://generativelanguage.googleapis.com/v1beta/models/'
const LIVE_URL   = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const TEXT_MODEL = 'gemini-flash-lite-latest'
// Modelos de voz "actuada" (la que suena expresiva). En el nivel gratis cada uno da
// 10 frases al día y ~3 por minuto, con cuota separada: rotándolos son ~40 al día.
const TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-lite-tts']
const LIVE_MODEL = 'gemini-3.8-live'        // sin límite diario pero más plana: sólo de respaldo
const VOICE      = 'Laomedeia'
const LIVE_SYSTEM = 'Eres una locutora de radio mexicana joven, cálida y carismática. Tu único trabajo es decir EN VOZ ALTA, ' +
  'palabra por palabra, el texto que te mandan, actuándolo con emoción, sonrisas en la voz, pausas naturales y acento ' +
  'mexicano relajado. No agregues, quites ni cambies nada. No respondas ni comentes: sólo dilo.'
const TTS_GAP_MS = 21000   // el nivel gratis de voz permite ~3 frases por minuto
// Estilo de la voz del DJ. Corto y separado del texto: con instrucciones largas el
// modelo a veces las lee en voz alta.
const VOICE_STYLE = 'Locutora de radio mexicana joven, cálida y alegre, ritmo ágil. Lee en voz alta sólo el texto entre corchetes:'

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
  const lastCall  = {}   // modelo → último uso (para respetar ~3 por minuto)
  const exhausted = {}   // modelo → día (hora del Pacífico) en que se acabó su cuota
  // La cuota diaria de Google se reinicia a medianoche del Pacífico
  const quotaDay = () => new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })

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
      if (j.error.code === 429) {
        // "PerDay" = se acabó la cuota del día; si no, sólo fue el límite por minuto
        const daily = (j.error.details || []).some(d => (d.violations || []).some(v => /PerDay/i.test(v.quotaId || '')))
        throw new Error(daily ? 'quota' : 'network')
      }
      if (j.error.code === 400 || j.error.code === 401 || j.error.code === 403) throw new Error('invalid-key')
      throw new Error('network')
    }
    return j
  }

  // Voz por la API en vivo: se abre una sesión, se manda el texto y se junta el audio que regresa
  function liveSpeak(text) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${LIVE_URL}?key=${encodeURIComponent(settings.key)}`)
      const pcm = []
      const fail = err => { clearTimeout(timer); try { ws.terminate() } catch {} reject(new Error(err)) }
      const timer = setTimeout(() => fail('network'), 60000)
      ws.on('open', () => ws.send(JSON.stringify({ setup: {
        model: 'models/' + LIVE_MODEL,
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
        systemInstruction: { parts: [{ text: LIVE_SYSTEM }] },
      } })))
      ws.on('message', raw => {
        let m
        try { m = JSON.parse(raw) } catch { return }
        if (m.setupComplete) {
          ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }))
          return
        }
        for (const p of m.serverContent?.modelTurn?.parts || []) if (p.inlineData) pcm.push(Buffer.from(p.inlineData.data, 'base64'))
        if (m.serverContent?.turnComplete) {
          clearTimeout(timer)
          ws.close()
          pcm.length ? resolve(pcmToWav(Buffer.concat(pcm), 24000)) : reject(new Error('network'))
        }
      })
      ws.on('close', code => { if (code === 1008 || code === 1011) fail(code === 1008 ? 'invalid-key' : 'quota') })
      ws.on('error', () => fail('network'))
    })
  }

  async function ttsSpeak(model, text) {
    lastCall[model] = Date.now()
    const j = await request(model, {
      contents: [{ parts: [{ text: `${VOICE_STYLE}\n[${text}]` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    })
    const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
    if (!part) throw new Error('network')
    const data = Buffer.from(part.inlineData.data, 'base64')
    const wav = /wav/.test(part.inlineData.mimeType) ? data : pcmToWav(data, +(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] || 24000))
    // Si dura mucho más de lo que se tarda en decir el texto, leyó de más (p. ej. la instrucción)
    const words = text.split(/\s+/).filter(Boolean).length
    if (wavSeconds(wav) > words * 0.62 + 2) throw new Error('misread')
    return wav
  }

  // Frase → archivo de audio. Se guarda en caché: lo que ya se dijo una vez no gasta otra vez.
  // Primero la voz actuada rotando modelos; cuando se acaban las del día, la API en vivo.
  function say(text) {
    const file = path.join(VOICE_DIR, crypto.createHash('sha1').update(VOICE + VOICE_STYLE + text).digest('hex') + '.wav')
    if (fs.existsSync(file)) return Promise.resolve(file)
    const run = ttsChain.then(async () => {
      if (fs.existsSync(file)) return file
      let wav = null
      const day = quotaDay()
      // El modelo disponible que menos tenga que esperar por el límite por minuto
      // Siempre el primer modelo disponible (cada uno hace la voz un poco distinta): sólo se
      // pasa al siguiente cuando se acaba su cuota del día. Un intento extra si leyó de más.
      let misreads = 0
      for (const model of TTS_MODELS.filter(m => exhausted[m] !== day)) {
        for (let attempt = 0; attempt < 2 && !wav; attempt++) {
          const wait = (lastCall[model] || 0) + TTS_GAP_MS - Date.now()
          if (wait > 0) await sleep(wait)
          try { wav = await ttsSpeak(model, text) }
          catch (e) {
            if (e.message === 'quota') { exhausted[model] = day; break }
            if (e.message === 'misread' && ++misreads < 3) continue
            break
          }
        }
        if (wav || misreads >= 3) break
      }
      if (!wav) wav = await liveSpeak(text)
      fs.mkdirSync(VOICE_DIR, { recursive: true })
      fs.writeFileSync(file, wav)
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

// Duración de un wav PCM (lee la cabecera)
function wavSeconds(wav) {
  const rate = wav.readUInt32LE(24), bytesPerSec = wav.readUInt32LE(28) || rate * 2
  return (wav.length - 44) / bytesPerSec
}

function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}
