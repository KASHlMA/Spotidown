// Análisis de audio local con los modelos de Essentia (Discogs-EffNet) en ONNX.
// Reproduce el preprocesado de TensorflowInputMusiCNN de Essentia:
// 16 kHz mono, frames de 512 / hop 256, ventana Hann, espectro de potencia,
// 96 bandas mel (Slaney, normalización unit_tri) y log10(1 + 10000·x).
const { spawn } = require('child_process')
const fs   = require('fs')
const path = require('path')
const ort  = require('onnxruntime-node')

const SR          = 16000
const FRAME       = 512
const HOP         = 256
const BANDS       = 96
const PATCH       = 128      // frames por parche (~2 s)
const PATCH_HOP   = 62
const MAX_PATCHES = 40       // suficiente para describir la canción sin analizarla entera

const MODELS = path.join(__dirname, 'models')
const EFFNET = 'discogs-effnet-bsdynamic-1'
const MOOD   = 'mtg_jamendo_moodtheme-discogs-effnet-1'

function findFfmpeg() {
  for (const p of [path.join(__dirname, '..', 'ffmpeg.exe'), path.join(__dirname, 'ffmpeg.exe')])
    if (fs.existsSync(p)) return p
  return 'ffmpeg'
}
const FFMPEG = findFfmpeg()

// MP3 → Float32Array mono a 16 kHz
function decode(file) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'],
      { windowsHide: true })
    const chunks = []
    let err = ''
    ff.stdout.on('data', c => chunks.push(c))
    ff.stderr.on('data', c => { err += c })
    ff.on('error', reject)
    ff.on('close', code => {
      const buf = Buffer.concat(chunks)
      if (!buf.length) return reject(new Error(err.trim() || `ffmpeg salió con código ${code}`))
      resolve(new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2))
    })
  })
}

// ── Banco de filtros mel (igual que Essentia MelBands slaneyMel + unit_tri) ───
const hz2mel = f => f < 1000 ? f / (200 / 3) : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27)
const mel2hz = m => m < 15 ? m * (200 / 3) : 1000 * Math.exp((m - 15) * (Math.log(6.4) / 27))

const NBINS  = FRAME / 2 + 1
const FILTERS = (() => {
  const hi = hz2mel(SR / 2), step = hi / (BANDS + 1)
  const edges = Array.from({ length: BANDS + 2 }, (_, i) => mel2hz(i * step))
  const scale = (SR / 2) / (NBINS - 1)
  const out = []
  for (let i = 0; i < BANDS; i++) {
    const [f0, f1, f2] = [edges[i], edges[i + 1], edges[i + 2]]
    const area = ((f1 - f0) + (f2 - f1)) / 2
    const from = Math.ceil(f0 / scale), to = Math.floor(f2 / scale)
    const w = []
    for (let j = from; j <= to; j++) {
      const f = j * scale
      w.push((f < f1 ? (f - f0) / (f1 - f0) : (f2 - f) / (f2 - f1)) / area)
    }
    out.push({ from, w })
  }
  return out
})()

// Hann simétrica (Essentia: 0.5 - 0.5·cos(2πi/(N-1)))
const WINDOW = Float32Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FRAME - 1)))

// FFT radix-2 in-place
const BITREV = (() => {
  const r = new Uint16Array(FRAME), bits = Math.log2(FRAME)
  for (let i = 0; i < FRAME; i++) { let x = i, y = 0; for (let b = 0; b < bits; b++) { y = (y << 1) | (x & 1); x >>= 1 } r[i] = y }
  return r
})()
const COS = Float64Array.from({ length: FRAME / 2 }, (_, i) => Math.cos(-2 * Math.PI * i / FRAME))
const SIN = Float64Array.from({ length: FRAME / 2 }, (_, i) => Math.sin(-2 * Math.PI * i / FRAME))

function magnitude(frame, re, im, mag) {
  for (let i = 0; i < FRAME; i++) { re[BITREV[i]] = frame[i] * WINDOW[i]; im[BITREV[i]] = 0 }
  for (let size = 2; size <= FRAME; size <<= 1) {
    const half = size >> 1, step = FRAME / size
    for (let s = 0; s < FRAME; s += size) {
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, c = COS[k * step], d = SIN[k * step]
        const tr = re[b] * c - im[b] * d, ti = re[b] * d + im[b] * c
        re[b] = re[a] - tr; im[b] = im[a] - ti
        re[a] += tr;        im[a] += ti
      }
    }
  }
  // MelBands de Essentia usa type='power' por defecto: espectro al cuadrado
  for (let i = 0; i < NBINS; i++) mag[i] = re[i] * re[i] + im[i] * im[i]
}

// Mel-espectrograma de los frames [first, first+count)
function melFrames(pcm, first, count, out, offset) {
  const frame = new Float32Array(FRAME), re = new Float64Array(FRAME), im = new Float64Array(FRAME)
  const mag = new Float64Array(NBINS)
  for (let f = 0; f < count; f++) {
    // FrameCutter de Essentia centra el primer frame en 0
    const start = (first + f) * HOP - FRAME / 2
    for (let i = 0; i < FRAME; i++) { const k = start + i; frame[i] = k >= 0 && k < pcm.length ? pcm[k] : 0 }
    magnitude(frame, re, im, mag)
    const row = offset + f * BANDS
    for (let b = 0; b < BANDS; b++) {
      const { from, w } = FILTERS[b]
      let s = 0
      for (let j = 0; j < w.length; j++) s += mag[from + j] * w[j]
      out[row + b] = Math.log10(1 + 10000 * s)
    }
  }
}

let sessions = null
async function loadModels() {
  if (sessions) return sessions
  // Pocos hilos: corre en segundo plano mientras suena música
  const opts = { intraOpNumThreads: Math.max(1, Math.min(3, require('os').cpus().length - 2)) }
  const [effnet, mood] = await Promise.all([
    ort.InferenceSession.create(path.join(MODELS, EFFNET + '.onnx'), opts),
    ort.InferenceSession.create(path.join(MODELS, MOOD + '.onnx'), opts),
  ])
  const meta = name => JSON.parse(fs.readFileSync(path.join(MODELS, name + '.json'), 'utf8'))
  sessions = { effnet, mood, genreClasses: meta(EFFNET).classes, moodClasses: meta(MOOD).classes }
  return sessions
}

// Devuelve probabilidades medias de 400 estilos, 56 moods y el embedding (1280)
async function analyze(file) {
  const s = await loadModels()
  const pcm = await decode(file)
  const nFrames = Math.floor(pcm.length / HOP)
  const total = Math.max(1, Math.floor((nFrames - PATCH) / PATCH_HOP) + 1)
  // Se reparten los parches por la canción, saltando intro y final
  const lo = total > 10 ? Math.floor(total * 0.08) : 0
  const hi = total > 10 ? Math.ceil(total * 0.92) : total
  const n = Math.min(MAX_PATCHES, hi - lo)
  const input = new Float32Array(n * PATCH * BANDS)
  for (let p = 0; p < n; p++) {
    const idx = lo + Math.floor(p * (hi - lo) / n)
    melFrames(pcm, idx * PATCH_HOP, PATCH, input, p * PATCH * BANDS)
  }

  const eff = s.effnet
  const res = await eff.run({ [eff.inputNames[0]]: new ort.Tensor('float32', input, [n, PATCH, BANDS]) })
  const [predName, embName] = eff.outputNames
  const mean = (t, dim) => {
    const out = new Float32Array(dim)
    for (let p = 0; p < n; p++) for (let i = 0; i < dim; i++) out[i] += t.data[p * dim + i] / n
    return out
  }
  const genres = mean(res[predName], 400)
  const embeds = res[embName]

  // El modelo de mood recibe embeddings de 1 parche; se promedian las predicciones
  const md = s.mood
  const mres = await md.run({ [md.inputNames[0]]: new ort.Tensor('float32', embeds.data, [n, 1280]) })
  const moodOut = mres[md.outputNames.find(o => /Sigmoid/i.test(o)) || md.outputNames[0]]
  const moods = new Float32Array(56)
  for (let p = 0; p < n; p++) for (let i = 0; i < 56; i++) moods[i] += moodOut.data[p * 56 + i] / n

  return { genres, moods, emb: mean(embeds, 1280), duration: pcm.length / SR }
}

module.exports = { analyze, loadModels }
