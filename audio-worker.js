// Proceso aparte (utilityProcess) que analiza canciones una por una con prioridad baja,
// para que el reproductor no se trabe mientras clasifica la biblioteca.
const os = require('os')
const { analyze, loadModels } = require('./audio-analysis')
const { lyricsMood } = require('./lyrics-mood')

try { os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL) } catch {}

const queue = []
const lyricQueue = []    // canciones ya analizadas a las que sólo les falta el ánimo por letra
let running = false

// Letra incrustada (USLT) → ánimo; null si no tiene letra
async function readLyricsMood(path) {
  try {
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(path, { skipCovers: true })
    let text = ''
    const l = meta.common.lyrics?.[0]
    if (l) text = typeof l === 'string' ? l : (l.text || '')
    if (!text) {
      for (const fmt of Object.keys(meta.native || {})) {
        const u = meta.native[fmt].find(t => t.id === 'USLT')
        if (u) { text = typeof u.value === 'string' ? u.value : (u.value?.text || ''); break }
      }
    }
    return lyricsMood(text)
  } catch {
    return null
  }
}

function top(values, classes, n, min) {
  return [...values].map((v, i) => [classes[i], +v.toFixed(3)])
    .filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).slice(0, n)
}

// Embedding normalizado y cuantizado a int8 en base64 (1.7 KB por canción)
function packEmbedding(emb) {
  const norm = Math.hypot(...emb) || 1
  let max = 0
  for (const x of emb) max = Math.max(max, Math.abs(x / norm))
  const q = Int8Array.from(emb, x => Math.round((x / norm) / (max || 1) * 127))
  return Buffer.from(q.buffer).toString('base64')
}

async function pump() {
  if (running) return
  running = true
  try {
    let s = null
    while (lyricQueue.length || queue.length) {
      // Primero las letras: son rápidas y dan el ánimo de toda la biblioteca en un par de minutos
      if (lyricQueue.length) {
        const { path } = lyricQueue.shift()
        process.parentPort.postMessage({ type: 'lyrics', path, lyr: await readLyricsMood(path) })
        if (lyricQueue.length % 25 === 0) process.parentPort.postMessage({ type: 'progress', left: queue.length, lyrics: lyricQueue.length })
        continue
      }
      s = s || await loadModels()
      const { path, mtime } = queue.shift()
      try {
        const r = await analyze(path)
        process.parentPort.postMessage({
          type: 'result', path,
          data: {
            mtime,
            styles: top(r.genres, s.genreClasses, 10, 0.03),
            moods:  top(r.moods, s.moodClasses, 8, 0.03),
            emb:    packEmbedding(r.emb),
            lyr:    await readLyricsMood(path),
          },
        })
      } catch (e) {
        // Archivo dañado o ilegible: se marca para no reintentarlo en cada arranque
        process.parentPort.postMessage({ type: 'result', path, data: { mtime, error: String(e.message).slice(0, 200) } })
      }
      process.parentPort.postMessage({ type: 'progress', left: queue.length })
    }
  } catch (e) {
    process.parentPort.postMessage({ type: 'fatal', error: String(e.message) })
  }
  running = false
}

process.parentPort.on('message', ({ data }) => {
  if (data.type === 'analyze') {
    const known = new Set(queue.map(q => q.path))
    for (const it of data.items) if (!known.has(it.path)) queue.push(it)
    const knownL = new Set(lyricQueue.map(q => q.path))
    for (const it of data.lyrics || []) if (!knownL.has(it.path)) lyricQueue.push(it)
    pump()
  } else if (data.type === 'clear') {
    queue.length = 0
  }
})
