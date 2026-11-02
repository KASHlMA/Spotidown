// Voz Dalia (Microsoft Edge, gratis y sin límite) "actuada": el texto se parte en
// frases y cada una lleva su propio ritmo, tono y pausa, para que no suene leído.
const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts')

const VOICE = 'es-MX-DaliaNeural'

function findFfmpeg() {
  for (const p of [path.join(__dirname, '..', 'ffmpeg.exe'), path.join(__dirname, 'ffmpeg.exe')])
    if (fs.existsSync(p)) return p
  return 'ffmpeg'
}
const FFMPEG = findFfmpeg()

// [ritmo, tono, pausa después (s)] según cómo termina la frase
function prosody(part) {
  const end = part.trim().slice(-1)
  if (end === '?') return ['+6%', '+10Hz', 0.45]
  if (end === '!') return ['+8%', '+8Hz', 0.35]
  if (end === '…') return ['-4%', '-2Hz', 0.4]
  if (end === ',') return ['+4%', '+3Hz', 0.18]
  return ['+3%', '+2Hz', 0.4]
}

function splitPhrases(text) {
  const raw = text.replace(/\.\.\./g, '…').match(/[^.!?…,;]+[.!?…,;]*\s*/g) || [text]
  const out = []
  for (const p of raw.map(s => s.trim()).filter(Boolean)) {
    // Pedacitos muy cortos ("Oye,") van pegados al siguiente para no sonar cortado
    if (out.length && out[out.length - 1].length < 10) out[out.length - 1] += ' ' + p
    else out.push(p)
  }
  return out
}

async function synth(text, rate, pitch) {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
  const { audioStream } = tts.toStream(text, { rate, pitch })
  return new Promise((resolve, reject) => {
    const chunks = []
    const timer = setTimeout(() => reject(new Error('network')), 20000)
    audioStream.on('data', c => chunks.push(c))
    audioStream.on('close', () => { clearTimeout(timer); tts.close?.(); chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error('network')) })
    audioStream.on('error', () => { clearTimeout(timer); reject(new Error('network')) })
  })
}

// Une las frases con sus pausas en un solo wav
function join(files, pauses, out) {
  const args = ['-v', 'error', '-y']
  for (const f of files) args.push('-i', f)
  const chains = files.map((_, i) => `[${i}:a]aresample=24000,apad=pad_dur=${pauses[i]}[a${i}]`)
  args.push('-filter_complex', `${chains.join(';')};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[out]`,
            '-map', '[out]', '-ac', '1', out)
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { windowsHide: true })
    ff.on('error', reject)
    ff.on('close', code => code === 0 ? resolve(out) : reject(new Error('ffmpeg')))
  })
}

module.exports = function createVoice(dir) {
  const VOICE_DIR = path.join(dir, 'dj-voice')
  return {
    async say(text) {
      const file = path.join(VOICE_DIR, crypto.createHash('sha1').update('dalia-v1' + text).digest('hex') + '.wav')
      if (fs.existsSync(file)) return file
      fs.mkdirSync(VOICE_DIR, { recursive: true })
      const parts = splitPhrases(text)
      const tmp = [], pauses = []
      try {
        for (const [i, p] of parts.entries()) {
          const [rate, pitch, pause] = prosody(p)
          const f = `${file}.${i}.mp3`
          fs.writeFileSync(f, await synth(p, rate, pitch))
          tmp.push(f)
          pauses.push(i === parts.length - 1 ? 0.1 : pause)
        }
        return await join(tmp, pauses, file)
      } finally {
        for (const f of tmp) fs.rmSync(f, { force: true })
      }
    },
  }
}
