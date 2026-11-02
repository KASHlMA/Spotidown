const fs        = require('fs')
const path      = require('path')
const crypto    = require('crypto')
const WebSocket = require('ws')

const API        = 'https://generativelanguage.googleapis.com/v1beta/models/'
const LIVE_URL   = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const TEXT_MODEL = 'gemini-flash-lite-latest'
// Voz de DJ Nat: audio nativo por la API en vivo (sin límite diario en el nivel gratis,
// aunque Google limita cuántas sesiones se abren por minuto). Los modelos de voz "TTS"
// sólo dan 10 al día: ya no se usan; si la voz nativa falla, el renderer usa Dalia.
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest'
const VOICE      = 'Laomedeia'
// El guion va en las instrucciones y sólo se le dice "¡Al aire!": si el texto llega como
// mensaje, la voz a veces lo toma como una petición y contesta o se brinca partes.
// La personalidad va descrita como "quién es", no como "cómo decirlo": con frases tipo
// "con sonrisas y acento mexicano" la voz a veces decía en voz alta una acotación como
// "(Con energía, sonriendo y con acento mexicano)".
const liveSystem = script => 'Eres DJ Nat, una locutora de radio mexicana de 25 años: muy expresiva, cálida, juguetona, ' +
  'carismática y siempre de buenas. Estás al aire. Cuando el productor diga "¡Al aire!", dices tu guion COMPLETO, de la ' +
  'primera a la última palabra, con toda tu personalidad. Sólo dices las palabras del guion: nada de acotaciones, ' +
  'descripciones ni texto entre paréntesis, no agregues ni quites nada, no comentes, y NUNCA menciones canciones, ' +
  'artistas ni datos que no estén en el guion. Tu guion es:\n' + script
const ON_AIR = '¡Al aire!'
// Cambiar esta etiqueta invalida la caché de audios generados con versiones anteriores
const VOICE_VERSION = 'v5-al-aire'

const sleep = ms => new Promise(r => setTimeout(r, ms))

function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def }
}

// Cliente de Gemini (nivel gratis): texto para el "cerebro" del DJ y su voz
module.exports = function createGemini(dir) {
  const SETTINGS_PATH = path.join(dir, 'gemini.json')
  const VOICE_DIR     = path.join(dir, 'dj-voice')
  const settings = readJson(SETTINGS_PATH, {})
  // Registro de cuándo la voz nativa falla o sale distinta al texto
  const LOG_PATH = path.join(dir, 'dj-voice.log')
  function log(event, detail, text) {
    try {
      if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 200000) fs.renameSync(LOG_PATH, LOG_PATH + '.old')
      fs.appendFileSync(LOG_PATH, `${new Date().toLocaleString('es-MX')}\t${event}\t${detail}\t${String(text).slice(0, 120)}\n`)
    } catch {}
  }
  // Audios de un solo uso de versiones anteriores
  try { for (const f of fs.readdirSync(VOICE_DIR)) if (f.startsWith('tmp-')) fs.rmSync(path.join(VOICE_DIR, f), { force: true }) } catch {}

  async function request(model, body, key = settings.key, signal = null) {
    let res
    try {
      res = await fetch(API + model + ':generateContent', {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
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

  // Sesión de la API en vivo para decir `script` (una por frase). speak(mensaje) se resuelve
  // con el PCM (16 bits, 24 kHz) de ese turno; said() es lo que dijo de verdad (transcripción).
  function openLive(script) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${LIVE_URL}?key=${encodeURIComponent(settings.key)}`)
      let ready = false, closed = false, turn = null, said = ''
      const errOf = (code, reason) => code === 1008 ? 'invalid-key'
        : /quota|exhaust/i.test(String(reason)) ? 'quota' : 'network'
      const setupTimer = setTimeout(() => ws.terminate(), 15000)
      ws.on('open', () => ws.send(JSON.stringify({ setup: {
        model: 'models/' + LIVE_MODEL,
        // Temperatura baja y sin "pensar" antes de hablar: pensando, a veces no generaba audio
        // o se ponía a contestar en lugar de decir el guion (y tardaba ~2 s más)
        generationConfig: { temperature: 0.3, responseModalities: ['AUDIO'], thinkingConfig: { thinkingBudget: 0 },
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
        systemInstruction: { parts: [{ text: liveSystem(script) }] },
        outputAudioTranscription: {},
      } })))
      ws.on('message', raw => {
        let m
        try { m = JSON.parse(raw) } catch { return }
        if (m.setupComplete) { ready = true; clearTimeout(setupTimer); resolve(session); return }
        if (m.serverContent?.outputTranscription?.text) {
          said += m.serverContent.outputTranscription.text
          // Google a veces manda la transcripción pero nunca el audio: si ya va diciendo
          // palabras y en 5 s no llega sonido, se corta ahí en lugar de esperar al final. (El audio
          // normalmente llega 0.7–1.6 s DESPUÉS del texto: con 1.5 s se cortaban respuestas buenas)
          if (turn && !turn.pcm.length && !turn.noAudio) {
            turn.noAudio = setTimeout(() => { if (turn && !turn.pcm.length) { turn.silent = true; ws.terminate() } }, 5000)
          }
        }
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
          clearTimeout(t.noAudio)
          t.resolve(Buffer.concat(t.pcm))
        }
      })
      // Cualquier cierre inesperado se nota al instante
      ws.on('close', (code, reason) => {
        closed = true
        // detail: código y motivo de Google, para el registro
        const err = Object.assign(new Error(errOf(code, reason)), { detail: `cierre ${code} ${String(reason).slice(0, 100)}` })
        if (!ready) { clearTimeout(setupTimer); reject(err) }
        if (turn) {
          const t = turn
          turn = null
          clearTimeout(t.timer)
          clearTimeout(t.noAudio)
          if (t.silent) err.detail = `sin audio; dijo: ${said}`
          t.reject(Object.assign(err, { partial: t.pcm.length > 0 }))
        }
      })
      ws.on('error', () => {})   // siempre le sigue 'close'
      const session = {
        // onChunk recibe cada pedazo de audio en cuanto llega (para que suene al instante)
        speak(text, onChunk) {
          return new Promise((res, rej) => {
            if (closed) return rej(new Error('network'))
            turn = { pcm: [], onChunk, resolve: res, reject: rej, timer: setTimeout(() => ws.terminate(), 30000) }
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
      try { return await openLive(text) }
      catch (e) {
        log('falló', `abrir sesión (intento ${attempt}): ${e.message} ${e.detail || ''}`, text)
        if (e.message === 'invalid-key' || attempt === 3) throw e
        await sleep(e.message === 'quota' ? 12000 : 1000)
      }
    }
  }

  // Lo que dijo vs. lo que debía decir: la voz nativa a veces improvisa, se brinca partes o
  // dice acotaciones como "(con energía)". Revisa palabras de más y palabras que faltan.
  function faithful(text, said) {
    if (!said.trim()) return true   // sin transcripción no se puede juzgar
    if (/[([]/.test(said)) return false
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2)
    const want = norm(text), got = norm(said)
    const wantSet = new Set(want), gotSet = new Set(got)
    const extra = got.filter(w => !wantSet.has(w)).length
    const missing = want.filter(w => !gotSet.has(w)).length
    return extra <= Math.max(2, got.length * 0.2) && missing <= Math.max(1, want.length * 0.25)
  }

  // Lo que quedó sin decir al final del guion (null si lo dijo todo o falta muy poco).
  // Las palabras se comparan en orden, así un "con" dicho antes no cuenta como el del final.
  function missingTail(text, said) {
    const norm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '')
    const got = said.split(/\s+/).map(norm).filter(Boolean)
    const words = text.split(/\s+/).filter(Boolean)
    let pos = 0, last = -1
    words.forEach((w, i) => {
      const n = norm(w)
      if (n.length <= 2) return
      const at = got.indexOf(n, pos)
      if (at >= 0) { pos = at + 1; last = i }
    })
    if (last < 2) return null   // no empezó con el guion: no es un corte, es otra cosa
    const tail = words.slice(last + 1)
    return tail.filter(w => norm(w).length > 2).length >= 3 ? tail.join(' ') : null
  }

  // Genera la frase completa y la verifica antes de entregarla (nunca suena una frase mal):
  // - sin audio (Google a veces sólo transcribe): se reintenta esperando un poco
  // - cortó el final: se genera sólo lo que faltó y se pega
  // - salió distinta (improvisó, se brincó algo, dijo acotaciones): se genera otra vez
  // Hasta 3 intentos; si ninguno sale bien, lanza error y el renderer usa Dalia.
  // Se usa para frases que se preparan con calma (el siguiente bloque).
  async function liveSay(text) {
    const attempts = 3
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let session = null
      try {
        session = await openLiveRetry(text)
        let buf = await session.speak(ON_AIR)
        if (!buf.length) throw Object.assign(new Error('network'), { detail: `sin audio; dijo: ${session.said()}` })
        await sleep(1200)   // la transcripción llega un poco después que el audio
        let said = session.said()
        session.close()
        const tail = missingTail(text, said)
        if (tail) {
          log('completando', `faltó: ${tail}`, text)
          const s2 = await openLiveRetry(tail)
          try {
            const more = await s2.speak(ON_AIR)
            await sleep(1200)
            if (more.length && faithful(tail, s2.said())) {
              buf = Buffer.concat([buf, Buffer.alloc(Math.round(24000 * 0.15) * 2), more])
              said += ' ' + s2.said()
            }
          } finally {
            s2.close()
          }
        }
        if (faithful(text, said)) return pcmToWav(buf, 24000)
        log('distinta', `intento ${attempt}, dijo: ${said}`, text)
      } catch (e) {
        log('falló', `intento ${attempt}: ${e.message} ${e.detail || ''}`, text)
        if (e.message === 'invalid-key') throw e
      } finally {
        session?.close()
      }
      // Reintentos pegados también salían sin audio (Google satura y sólo transcribe): espera
      if (attempt < attempts) await sleep(attempt * 4000)
    }
    throw new Error('unfaithful')
  }

  // Frase → archivo de audio verificado. Se guarda en caché: lo que ya se dijo una vez no
  // gasta otra vez.
  const fileFor = text => path.join(VOICE_DIR, crypto.createHash('sha1').update(VOICE + VOICE_VERSION + text).digest('hex') + '.wav')

  async function say(text) {
    const file = fileFor(text)
    if (fs.existsSync(file)) return file
    const wav = await liveSay(text)
    fs.mkdirSync(VOICE_DIR, { recursive: true })
    fs.writeFileSync(file, wav)
    return file
  }

  // Para cuando alguien está esperando: el audio se manda a onChunk en cuanto llega, así Nat
  // empieza a hablar en ~2-3 s. Un solo intento (si Google no manda audio, lanza error sin haber
  // sonado nada y el renderer usa Dalia, que ya tiene lista). Si cortó el final, lo que faltó
  // se genera y se encadena también en vivo. Se resuelve con { file } si ya estaba en caché.
  async function sayNow(text, onChunk) {
    const file = fileFor(text)
    if (fs.existsSync(file)) return { file }
    const session = await openLive(text)
    let emitted = false
    // Compuerta: el audio se retiene hasta que la transcripción muestra cómo empieza. Si
    // empieza con una acotación "(Con energía…)", se corta antes de que se escuche nada.
    const held = []
    let open = false, stage = false
    const release = () => { open = emitted = true; for (const x of held.splice(0)) onChunk(x) }
    const gate = b => {
      if (open) { onChunk(b); return }
      held.push(b)
      const said = session.said().trim()
      if (/^[([]/.test(said)) { stage = true; session.close(); return }
      const heldSec = held.reduce((n, x) => n + x.length, 0) / 48000
      if (said.split(/\s+/).length >= 2 || heldSec > 1.2) release()
    }
    try {
      let buf
      try {
        buf = await session.speak(ON_AIR, gate)
      } catch (e) {
        if (stage) throw Object.assign(new Error('network'), { detail: `acotación: ${session.said()}` })
        throw e
      }
      if (!buf.length) throw Object.assign(new Error('network'), { detail: `sin audio; dijo: ${session.said()}` })
      if (!open) release()   // frase cortita: terminó antes de abrir la compuerta
      await sleep(1200)   // la transcripción llega un poco después que el audio
      let said = session.said()
      session.close()
      const tail = missingTail(text, said)
      if (tail) {
        log('completando', `faltó: ${tail}`, text)
        const gap = Buffer.alloc(Math.round(24000 * 0.15) * 2)
        onChunk(gap)
        const s2 = await openLive(tail)
        try {
          const more = await s2.speak(ON_AIR, onChunk)
          await sleep(1200)
          buf = Buffer.concat([buf, gap, more])
          said += ' ' + s2.said()
        } finally {
          s2.close()
        }
      }
      // Sólo se guarda si dijo exactamente el texto (así la próxima vez sale de la caché)
      if (faithful(text, said)) {
        fs.mkdirSync(VOICE_DIR, { recursive: true })
        fs.writeFileSync(file, pcmToWav(buf, 24000))
      } else {
        log('distinta', `en vivo, dijo: ${said}`, text)
      }
      return {}
    } catch (e) {
      log('falló', `en vivo: ${e.message} ${e.detail || ''}`, text)
      throw Object.assign(e, { partial: emitted })
    } finally {
      session.close()
    }
  }

  // Texto (o JSON si se pasa un schema)
  // Google a veces tarda muchísimo en contestar la MISMA petición (medido: casi siempre <1.3 s,
  // pero a veces 10, 40 y hasta 51 s). Si no contesta pronto se manda otra igual en paralelo y
  // gana la primera; si aun así se pasa del límite, error (el renderer usa una frase armada).
  // urgent: alguien está esperando (respaldo a los 1.5 s, se rinde a los 6 s).
  function think(system, prompt, schema, urgent = false) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: schema
        ? { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.9 }
        : { temperature: 1 },
    }
    const hedgeAfter = urgent ? 1500 : 6000, giveUp = urgent ? 6000 : 45000
    return new Promise((resolve, reject) => {
      const ctrls = []
      let done = false, running = 0, hedged = false
      const finish = (fn, v) => {
        if (done) return
        done = true
        clearTimeout(hedgeTimer); clearTimeout(giveUpTimer)
        for (const c of ctrls) c.abort()
        fn(v)
      }
      const launch = () => {
        const c = new AbortController()
        ctrls.push(c)
        running++
        request(TEXT_MODEL, body, settings.key, c.signal).then(j => {
          const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
          if (!text) throw new Error('network')
          finish(resolve, schema ? JSON.parse(text) : text)
        }).catch(e => {
          running--
          if (done) return
          if (e.message === 'quota' || e.message === 'invalid-key') return finish(reject, e)
          if (!hedged) { hedged = true; launch() }   // falló rápido: el respaldo de una vez
          else if (!running) finish(reject, e)
        })
      }
      const hedgeTimer = setTimeout(() => { if (!hedged) { hedged = true; launch() } }, hedgeAfter)
      const giveUpTimer = setTimeout(() => finish(reject, new Error('timeout')), giveUp)
      launch()
    })
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

    say, sayNow, think,
    cached: text => fs.existsSync(fileFor(text)),   // ¿esta frase ya está grabada?
    // Borra las frases de más de maxDays días (transiciones, peticiones: nunca se repiten
    // igual), menos las de keep (los saludos guardados, que sí se vuelven a usar)
    cleanup(keep, maxDays = 7) {
      const keepNames = new Set(keep.map(t => path.basename(fileFor(t))))
      const limit = Date.now() - maxDays * 864e5
      let removed = 0
      for (const name of fs.existsSync(VOICE_DIR) ? fs.readdirSync(VOICE_DIR) : []) {
        if (keepNames.has(name)) continue
        const f = path.join(VOICE_DIR, name)
        try { if (fs.statSync(f).mtimeMs < limit) { fs.unlinkSync(f); removed++ } } catch {}
      }
      return removed
    },
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
