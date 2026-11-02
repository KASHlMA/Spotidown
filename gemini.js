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
// Voz principal: audio nativo por la API en vivo. Sin límite diario en el nivel gratis, la
// instrucción va aparte (nunca se lee en voz alta) y el audio llega en tiempo real.
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest'
const VOICE      = 'Laomedeia'
const LIVE_SYSTEM = 'Eres DJ Nat, una locutora de radio mexicana joven, muy expresiva, cálida, juguetona y carismática. ' +
  'Cuando te mandan un texto, lo dices EN VOZ ALTA palabra por palabra, actuándolo de verdad: con muchas emociones, ' +
  'sonrisas en la voz, cambios de ritmo, energía de radio y acento mexicano. Di EXACTAMENTE ese texto: no agregues, ' +
  'quites ni cambies palabras, no comentes, y NUNCA menciones canciones, artistas ni datos que no estén en el texto.'
const TTS_GAP_MS = 21000   // el nivel gratis de voz permite ~3 frases por minuto
// A la voz actuada sólo se le manda el texto: cualquier instrucción de estilo la acababa
// leyendo en voz alta a veces. La emoción sale del propio texto (¡…!, ¿a poco no?, la neta…).
// Cambiar esta etiqueta invalida la caché de audios generados con versiones anteriores.
const VOICE_VERSION = 'v4-oraciones'

const sleep = ms => new Promise(r => setTimeout(r, ms))

function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def }
}

// Cliente de Gemini (nivel gratis): texto para el "cerebro" del DJ y voz (TTS)
module.exports = function createGemini(dir) {
  const SETTINGS_PATH = path.join(dir, 'gemini.json')
  const VOICE_DIR     = path.join(dir, 'dj-voice')
  const settings = readJson(SETTINGS_PATH, {})
  // Registro de cuándo la voz nativa falla o se usa el respaldo (que gasta las 10 diarias)
  const LOG_PATH = path.join(dir, 'dj-voice.log')
  function log(event, detail, text) {
    try {
      if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 200000) fs.renameSync(LOG_PATH, LOG_PATH + '.old')
      fs.appendFileSync(LOG_PATH, `${new Date().toLocaleString('es-MX')}\t${event}\t${detail}\t${String(text).slice(0, 120)}\n`)
    } catch {}
  }
  // Audios de un solo uso (frases en las que la voz improvisó) de sesiones anteriores
  try { for (const f of fs.readdirSync(VOICE_DIR)) if (f.startsWith('tmp-')) fs.rmSync(path.join(VOICE_DIR, f), { force: true }) } catch {}
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

  // Sesión de la API en vivo. Se abre una vez por frase y se le mandan las oraciones como
  // turnos: Google limita cuántas sesiones se abren por minuto, no cuántos turnos.
  // speak(texto, onChunk) se resuelve con el PCM (16 bits, 24 kHz) de ese turno; onChunk
  // recibe cada pedazo en cuanto llega. said() es la transcripción de todo lo que dijo.
  function openLive() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${LIVE_URL}?key=${encodeURIComponent(settings.key)}`)
      let ready = false, closed = false, turn = null, said = ''
      const errOf = (code, reason) => code === 1008 ? 'invalid-key'
        : /quota|exhaust/i.test(String(reason)) ? 'quota' : 'network'
      const setupTimer = setTimeout(() => ws.terminate(), 15000)
      ws.on('open', () => ws.send(JSON.stringify({ setup: {
        model: 'models/' + LIVE_MODEL,
        // Temperatura baja: que actúe el texto, no que improvise
        generationConfig: { temperature: 0.3, responseModalities: ['AUDIO'],
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
        systemInstruction: { parts: [{ text: LIVE_SYSTEM }] },
        outputAudioTranscription: {},
      } })))
      ws.on('message', raw => {
        let m
        try { m = JSON.parse(raw) } catch { return }
        if (m.setupComplete) { ready = true; clearTimeout(setupTimer); resolve(session); return }
        if (m.serverContent?.outputTranscription?.text) said += m.serverContent.outputTranscription.text
        if (!turn) return
        for (const p of m.serverContent?.modelTurn?.parts || []) {
          if (!p.inlineData) continue
          const buf = Buffer.from(p.inlineData.data, 'base64')
          turn.pcm.push(buf)
          turn.onChunk?.(buf)
        }
        if (m.serverContent?.turnComplete) {
          const t = turn
          turn = null
          clearTimeout(t.timer)
          t.resolve(Buffer.concat(t.pcm))
        }
      })
      // Cualquier cierre inesperado se nota al instante (antes se quedaba esperando 60 s)
      ws.on('close', (code, reason) => {
        closed = true
        const err = new Error(errOf(code, reason))
        if (!ready) { clearTimeout(setupTimer); reject(err) }
        if (turn) { const t = turn; turn = null; clearTimeout(t.timer); t.reject(Object.assign(err, { partial: t.pcm.length > 0 })) }
      })
      ws.on('error', () => {})   // siempre le sigue 'close'
      const session = {
        speak(text, onChunk) {
          return new Promise((res, rej) => {
            if (closed) return rej(new Error('network'))
            turn = { onChunk, pcm: [], resolve: res, reject: rej, timer: setTimeout(() => ws.terminate(), 30000) }
            ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }))
          })
        },
        said: () => said,
        close: () => { closed = true; try { ws.close() } catch {} },
      }
    })
  }

  // Abre sesión; si Google dice que se pasó del límite por minuto, espera y reintenta
  async function openLiveRetry(text) {
    for (let attempt = 1; ; attempt++) {
      try { return await openLive() }
      catch (e) {
        log('falló', `abrir sesión (intento ${attempt}): ${e.message}`, text)
        if (e.message === 'invalid-key' || attempt === 3) throw e
        await sleep(e.message === 'quota' ? 12000 : 1000)
      }
    }
  }

  async function ttsSpeak(model, text) {
    lastCall[model] = Date.now()
    log('respaldo', model, text)
    const j = await request(model, {
      contents: [{ parts: [{ text }] }],
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
  // Primero la voz nativa en vivo (sin límite; si hay onChunk se va reproduciendo mientras
  // llega). Si falla antes de mandar audio, la voz actuada (10 al día por modelo).
  // Lo que dijo vs. lo que debía decir: la voz nativa a veces improvisa (se inventó a
  // Juan Gabriel) o se brinca partes. Revisa palabras de más y palabras que faltan.
  function faithful(text, said) {
    if (!said.trim()) return true   // sin transcripción no se puede juzgar
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2)
    const want = norm(text), got = norm(said)
    const wantSet = new Set(want), gotSet = new Set(got)
    const extra = got.filter(w => !wantSet.has(w)).length
    const missing = want.filter(w => !gotSet.has(w)).length
    return extra <= Math.max(2, got.length * 0.2) && missing <= Math.max(1, want.length * 0.25)
  }

  // Una sesión por frase con el texto completo (en turnos separados la voz se pone a
  // platicar y deja pausas). Sin streaming (frases preparadas) se repite una vez si salió
  // distinta al texto; con streaming ya sonó, así que sólo se evita guardarla en caché.
  async function liveSay(text, onChunk) {
    const tries = onChunk ? 1 : 2
    for (let attempt = 1; ; attempt++) {
      const session = await openLiveRetry(text)
      let emitted = false
      try {
        const buf = await session.speak(text, b => { emitted = true; onChunk?.(b) })
        if (!buf.length) throw new Error('network')
        await sleep(700)   // la transcripción llega un poco después que el audio
        const ok = faithful(text, session.said())
        if (ok || attempt >= tries) {
          if (!ok) log('distinta', `dijo: ${session.said()}`, text)
          return { wav: pcmToWav(buf, 24000), ok }
        }
        log('repetida', `dijo: ${session.said()}`, text)
      } catch (e) {
        log('falló', `intento ${attempt}: ${e.message}`, text)
        if (emitted || attempt >= 2 || e.message === 'invalid-key') throw Object.assign(e, { partial: emitted })
      } finally {
        session.close()
      }
    }
  }

  async function say(text, onChunk) {
    const file = path.join(VOICE_DIR, crypto.createHash('sha1').update(VOICE + VOICE_VERSION + text).digest('hex') + '.wav')
    if (fs.existsSync(file)) return file
    try {
      const { wav, ok } = await liveSay(text, onChunk)
      fs.mkdirSync(VOICE_DIR, { recursive: true })
      if (ok) { fs.writeFileSync(file, wav); return file }
      // Algo salió distinto al texto: se reproduce, pero no se guarda en caché
      const tmp = path.join(VOICE_DIR, `tmp-${process.pid}-${Date.now()}.wav`)
      fs.writeFileSync(tmp, wav)
      return tmp
    } catch (e) {
      if (e.partial || e.message === 'invalid-key') throw e
    }
    return ttsFallback(text, file)
  }

  function ttsFallback(text, file) {
    const run = ttsChain.then(async () => {
      if (fs.existsSync(file)) return file
      let wav = null
      const day = quotaDay()
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
      if (!wav) throw new Error('quota')
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
