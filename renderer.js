// ── Config ────────────────────────────────────────────────────────────────────
const BAR_COUNT = 55

// ── State ─────────────────────────────────────────────────────────────────────
let allSongs    = []
let filtered    = []
let currentIdx  = -1
let currentSong = null   // objeto canción activo (sobrevive al re-filtrado)
let shuffle      = false
let shuffleQueue = []   // indices de filtered[] en orden barajado
let shufflePos   = -1   // posición actual dentro de shuffleQueue
let repeat      = false
let seeking     = false
let lyricLines  = []
let curLyric    = -1
let spectrumColors = { dark: '#3D2A10', mid: '#C8A97E', light: '#FFE0AA' }

// ── Audio (Web Audio API) ─────────────────────────────────────────────────────
const audio    = document.getElementById('audio')
const audioCtx = new AudioContext()
const analyser = audioCtx.createAnalyser()
const gainNode = audioCtx.createGain()
const srcNode  = audioCtx.createMediaElementSource(audio)

analyser.fftSize = 2048
srcNode.connect(analyser)
analyser.connect(gainNode)
gainNode.connect(audioCtx.destination)
gainNode.gain.value = 0.8

// ── Window controls ───────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click',   () => api.winMinimize())
document.getElementById('btn-max').addEventListener('click',   () => api.winMaximize())
document.getElementById('btn-close').addEventListener('click', () => api.winClose())

// ── Transport buttons ─────────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click',    togglePlay)
document.getElementById('btn-prev').addEventListener('click',    prevSong)
document.getElementById('btn-next').addEventListener('click',    nextSong)
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle)
document.getElementById('btn-repeat').addEventListener('click',  toggleRepeat)
document.getElementById('btn-queue').addEventListener('click',   toggleQueue)
document.getElementById('btn-queue-close').addEventListener('click', () => closeQueue())

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('search').addEventListener('input', filterSongs)
document.getElementById('search-artists').addEventListener('input', e => buildArtistList(e.target.value))

// ── Nav tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const tab = btn.dataset.tab
    document.getElementById('view-songs').style.display   = tab === 'songs'   ? 'flex' : 'none'
    document.getElementById('view-artists').style.display = tab === 'artists' ? 'flex' : 'none'
    document.getElementById('view-folders').style.display = tab === 'folders' ? 'flex' : 'none'
    if (tab === 'artists') buildArtistList()
    if (tab === 'folders') buildFolderList()
  })
})
document.getElementById('search-folders').addEventListener('input', e => buildFolderList(e.target.value))

document.getElementById('filter-clear').addEventListener('click', () => {
  setFiltered([...allSongs])
  renderList()
  document.getElementById('filter-bar').style.display = 'none'
})

// ── Spectrum ──────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('spectrum')
const ctx2d    = canvas.getContext('2d')
const fftData  = new Uint8Array(analyser.frequencyBinCount)
const smoothed = new Float32Array(BAR_COUNT)

let _cW = 0, _cH = 0

function drawSpectrum() {
  requestAnimationFrame(drawSpectrum)

  const W = canvas.offsetWidth
  const H = canvas.offsetHeight
  if (_cW !== W || _cH !== H) {
    canvas.width = _cW = W
    canvas.height = _cH = H
  }

  ctx2d.clearRect(0, 0, W, H)
  if (audio.paused) return

  analyser.getByteFrequencyData(fftData)

  // Un solo gradiente por frame para todos los bares
  const grad = ctx2d.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0,    spectrumColors.dark)
  grad.addColorStop(0.45, spectrumColors.mid)
  grad.addColorStop(1,    spectrumColors.light)
  ctx2d.fillStyle = grad

  const gap = 2
  const bw  = (W - gap * (BAR_COUNT - 1)) / BAR_COUNT
  const len = fftData.length

  for (let i = 0; i < BAR_COUNT; i++) {
    const lo = Math.floor(Math.pow(len * 0.8, i / BAR_COUNT))
    const hi = Math.ceil(Math.pow(len * 0.8, (i + 1) / BAR_COUNT))
    let peak = 0
    for (let j = lo; j < Math.min(hi, len); j++)
      if (fftData[j] > peak) peak = fftData[j]

    const target = peak / 255
    smoothed[i] = smoothed[i] > target
      ? smoothed[i] * 0.82
      : smoothed[i] * 0.25 + target * 0.75

    const bh = Math.max(smoothed[i] * H, 2)
    const x  = i * (bw + gap)
    ctx2d.beginPath()
    ctx2d.roundRect(x, H - bh, bw, bh, 2)
    ctx2d.fill()
  }
}
drawSpectrum()

// ── Custom sliders ────────────────────────────────────────────────────────────
function makeSlider(trackId, onDrag, onRelease) {
  const track = document.getElementById(trackId)
  const fill  = document.getElementById(trackId.replace('track','fill'))
  const thumb = document.getElementById(trackId.replace('track','thumb'))
  let dragging = false

  function pctFromEvent(e) {
    const r = track.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }

  function setVisual(pct) {
    fill.style.width  = (pct * 100) + '%'
    thumb.style.left  = (pct * 100) + '%'
  }

  track.addEventListener('mousedown', e => {
    dragging = true
    const p = pctFromEvent(e)
    setVisual(p)
    onDrag(p)
    e.preventDefault()
  })

  window.addEventListener('mousemove', e => {
    if (!dragging) return
    const p = pctFromEvent(e)
    setVisual(p)
    onDrag(p)
  })

  window.addEventListener('mouseup', e => {
    if (!dragging) return
    dragging = false
    const p = pctFromEvent(e)
    setVisual(p)
    onRelease ? onRelease(p) : onDrag(p)
  })

  return { set: setVisual }
}

// Barra de progreso
const seekSlider = makeSlider(
  'seek-track',
  pct => {
    seeking = true
    document.getElementById('t-cur').textContent = fmtTime(pct * getDur())
  },
  pct => {
    seeking = false
    audio.currentTime = pct * getDur()
  }
)

// Volumen (gain hasta 3.5 para más potencia)
const volSlider = makeSlider('vol-track', pct => {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  gainNode.gain.value = pct * 1.5
})
volSlider.set(1)
gainNode.gain.value = 1.5

// ── RAF loop (barra fluida a 60fps) ──────────────────────────────────────────
function rafLoop() {
  if (!seeking && !audio.paused && !audio.ended) {
    const dur = getDur()
    if (dur > 0) {
      seekSlider.set(audio.currentTime / dur)
      document.getElementById('t-cur').textContent = fmtTime(audio.currentTime)
      syncLyrics(audio.currentTime)
    }
  }
  requestAnimationFrame(rafLoop)
}
requestAnimationFrame(rafLoop)

// ── Audio events ──────────────────────────────────────────────────────────────
audio.addEventListener('loadedmetadata', () => {
  const dur = getDur()
  document.getElementById('t-tot').textContent = fmtTime(dur)
})
audio.addEventListener('ended', () => { if (!repeat) nextSong() })
audio.addEventListener('play',  () => setPlayIcon(false))
audio.addEventListener('pause', () => setPlayIcon(true))

function setPlayIcon(isPlay) {
  document.getElementById('icon-play').innerHTML = isPlay
    ? '<path d="M8 5v14l11-7z"/>'
    : '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
}

// ── Library ───────────────────────────────────────────────────────────────────
// ── Virtual Scroll ────────────────────────────────────────────────────────────
const ROW_HEIGHT = 52
const OVERSCAN   = 3

const vsList      = document.getElementById('song-list')
const vsSpacerTop = document.createElement('div')
const vsSpacerBot = document.createElement('div')
vsList.appendChild(vsSpacerTop)
vsList.appendChild(vsSpacerBot)

let vsStart        = 0
let vsEnd          = 0
let vsRafId        = null
let vsUpdatePending = false

function vsBuffer() {
  return Math.ceil((vsList.clientHeight || 500) / ROW_HEIGHT) + OVERSCAN * 2
}

function vsCalc() {
  const start = Math.max(0, Math.floor(vsList.scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end   = Math.min(filtered.length, start + vsBuffer())
  return { start, end }
}

function vsUpdateRow(li, i) {
  const s = filtered[i]
  li.dataset.idx = i
  li.className   = s === currentSong ? 'active' : ''
  li.querySelector('.li-title').textContent  = s.title  || ''
  li.querySelector('.li-artist').textContent = s.artist || ''
  const img = li.querySelector('.li-thumb img')
  if (s.cover) { img.src = s.cover }
  else { img.removeAttribute('src') }
  li.onclick = () => loadAndPlay(i)
}

function vsMakeLi() {
  const li = document.createElement('li')
  li.innerHTML = '<div class="li-thumb"><img alt=""/></div>' +
                 '<div class="li-text"><div class="li-title"></div><div class="li-artist"></div></div>'
  return li
}

function renderList() {
  const { start, end } = vsCalc()
  const count    = end - start
  const existing = [...vsList.querySelectorAll('li')]

  while (existing.length < count) {
    const li = vsMakeLi()
    vsList.insertBefore(li, vsSpacerBot)
    existing.push(li)
  }
  while (existing.length > count) existing.pop().remove()

  vsSpacerTop.style.height = (start * ROW_HEIGHT) + 'px'
  vsSpacerBot.style.height = (Math.max(0, filtered.length - end) * ROW_HEIGHT) + 'px'

  existing.forEach((li, j) => vsUpdateRow(li, start + j))

  vsStart = start
  vsEnd   = end
  vsRafId = null
}

function vsScrollToIndex(i) {
  const top = i * ROW_HEIGHT
  const bot = top + ROW_HEIGHT
  if (vsList.scrollTop > top) vsList.scrollTop = top
  else if (vsList.scrollTop + vsList.clientHeight < bot) vsList.scrollTop = bot - vsList.clientHeight
}

function scheduleListUpdate(fi) {
  if (fi < vsStart || fi >= vsEnd) return
  if (vsUpdatePending) return
  vsUpdatePending = true
  requestAnimationFrame(() => { vsUpdatePending = false; renderList() })
}

vsList.addEventListener('scroll', () => {
  if (vsRafId) return
  vsRafId = requestAnimationFrame(renderList)
})

async function scanLibrary() {
  setLibCount('Cargando…')

  const [cache, files] = await Promise.all([api.loadCache(), api.scanMusic()])
  // cache = { version: 1, songs: { path → { title, artist, album, duration, mtime } } }
  // files = [{ path, mtime }]

  const prevMap = new Map(allSongs.map(s => [s.path, s]))
  const pathSet = new Set(files.map(f => f.path))

  // Remove deleted files from cache
  for (const p of Object.keys(cache.songs)) {
    if (!pathSet.has(p)) delete cache.songs[p]
  }

  // Build allSongs from cache instantly
  allSongs = files.map(({ path: p, mtime }) => {
    const cached = cache.songs[p]
    if (cached && cached.mtime === mtime) {
      return prevMap.get(p) || {
        path: p, mtime,
        title: cached.title, artist: cached.artist,
        album: cached.album, duration: cached.duration,
        cover: null, lyrics: ''
      }
    }
    return prevMap.get(p) || {
      path: p, mtime,
      title: p.split('\\').pop().replace(/\.mp3$/i, '').replace(/^\d+\s*[-–.]\s*/, ''),
      artist: '', album: '', duration: 0, cover: null, lyrics: ''
    }
  })

  applyFilter()
  renderList()
  setLibCount(`${allSongs.length} canciones`)

  // Only read new/modified MP3s, 8 at a time in parallel
  const songMap  = new Map(allSongs.map(s => [s.path, s]))
  const uncached = files.filter(({ path: p, mtime }) => {
    const c = cache.songs[p]
    return !c || c.mtime !== mtime
  })

  const BATCH = 8
  for (let i = 0; i < uncached.length; i += BATCH) {
    await Promise.all(
      uncached.slice(i, i + BATCH).map(async ({ path: p, mtime }) => {
        const meta = await api.readMeta(p)
        const song = songMap.get(p)
        if (!song) return
        Object.assign(song, meta, { mtime, metaLoaded: true })
        cache.songs[p] = {
          title: meta.title, artist: meta.artist,
          album: meta.album, duration: meta.duration, mtime
        }
        const fi = filtered.indexOf(song)
        if (fi >= 0) scheduleListUpdate(fi)
        if (song === currentSong) {
          setCover(meta.cover)
          buildLyrics(meta.lyrics)
        }
      })
    )
  }

  await api.saveCache(cache)

  _artistsCache = null
  setLibCount(`${allSongs.length} canciones`)
  const activeTab = document.querySelector('.nav-tab.active')?.dataset?.tab
  if (activeTab === 'artists') buildArtistList()
}

function setFiltered(arr) {
  filtered   = arr
  currentIdx = currentSong ? filtered.indexOf(currentSong) : -1
  if (shuffle) buildShuffleQueue()
}

function applyFilter() {
  const q = document.getElementById('search').value.trim().toLowerCase()
  setFiltered(q
    ? allSongs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
    : [...allSongs])
}

let searchTimer = null

function filterSongs() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    applyFilter()
    document.getElementById('filter-bar').style.display = 'none'
    vsList.scrollTop = 0
    renderList()
  }, 300)
}

function setLibCount(t) { document.getElementById('lib-count').textContent = t }

// ── Load & play ───────────────────────────────────────────────────────────────
async function loadAndPlay(idx) {
  if (idx < 0 || idx >= filtered.length) return
  currentIdx  = idx
  currentSong = filtered[idx]
  // Sincronizar posición en cola barajada si shuffle está activo
  if (shuffle && shuffleQueue.length) {
    const pos = shuffleQueue.indexOf(idx)
    if (pos >= 0) shufflePos = pos
  }
  const song  = currentSong

  renderList()
  vsScrollToIndex(idx)

  document.getElementById('song-title').textContent  = song.title
  document.getElementById('song-artist').textContent = song.artist || ''
  document.getElementById('t-cur').textContent = '0:00'
  document.getElementById('t-tot').textContent = fmtTime(song.duration)
  seekSlider.set(0)

  if (song.metaLoaded) {
    setCover(song.cover)
    buildLyrics(song.lyrics)
  } else {
    setCover(null)
    buildLyrics('')
    api.readMeta(song.path).then(meta => {
      if (song !== currentSong) return
      Object.assign(song, meta, { metaLoaded: true })
      setCover(meta.cover)
      buildLyrics(meta.lyrics)
    }).catch(() => {})
  }

  if (document.getElementById('queue-panel').classList.contains('open')) renderQueue()

  if (audioCtx.state === 'suspended') audioCtx.resume()
  audio.src = encodeURI('file:///' + song.path.replace(/\\/g, '/'))
  audio.play().catch(err => {
    console.error('Error al reproducir:', song.path, err.message)
    document.getElementById('song-title').textContent  = '⚠ Error al reproducir'
    document.getElementById('song-artist').textContent = song.path.split('\\').pop()
  })
}

function extractColor(dataUrl, cb) {
  const tmp = new Image()
  tmp.onload = () => {
    const size = 60
    const c = document.createElement('canvas')
    c.width = c.height = size
    const cx = c.getContext('2d')
    cx.drawImage(tmp, 0, 0, size, size)
    const px = cx.getImageData(0, 0, size, size).data
    let br = 200, bg = 169, bb = 126, best = -1
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i+1], b = px[i+2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (max < 40 || max > 240) continue
      const l = (max + min) / 510
      const s = max === min ? 0 : (max - min) / (255 * (1 - Math.abs(2 * l - 1)))
      const score = s * (1 - Math.abs(l - 0.58))
      if (score > best) { best = score; br = r; bg = g; bb = b }
    }
    cb(br, bg, bb)
  }
  tmp.src = dataUrl
}

function applyAccent(r, g, b) {
  const toHex = n => n.toString(16).padStart(2, '0')
  const mid   = `#${toHex(r)}${toHex(g)}${toHex(b)}`
  const dark  = `#${toHex(Math.round(r*.25))}${toHex(Math.round(g*.25))}${toHex(Math.round(b*.25))}`
  const lr    = Math.min(255, r + 90), lg = Math.min(255, g + 90), lb = Math.min(255, b + 90)
  const light = `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`
  document.documentElement.style.setProperty('--accent', mid)
  document.documentElement.style.setProperty('--acc2', light)
  document.documentElement.style.setProperty('--cur-glow', `rgba(${r},${g},${b},.35)`)
  document.documentElement.style.setProperty('--cur-glow2', `rgba(${r},${g},${b},.12)`)
  spectrumColors = { dark, mid, light }
}

function resetAccent() {
  document.documentElement.style.setProperty('--accent', '#C8A97E')
  document.documentElement.style.setProperty('--acc2',   '#FFD7A0')
  spectrumColors = { dark: '#3D2A10', mid: '#C8A97E', light: '#FFE0AA' }
}

function setCover(dataUrl) {
  const img    = document.getElementById('cover-img')
  const noIcon = document.getElementById('no-cover')
  const glow   = document.getElementById('art-glow')

  const bgBlur = document.getElementById('bg-blur')

  if (dataUrl) {
    img.src = dataUrl
    img.style.display = 'block'
    noIcon.style.display = 'none'
    glow.style.backgroundImage = `url("${dataUrl}")`
    glow.style.opacity = '0.45'
    bgBlur.style.backgroundImage = `url("${dataUrl}")`
    bgBlur.style.opacity = '1'
    extractColor(dataUrl, (r, g, b) => applyAccent(r, g, b))
  } else {
    img.src = ''
    img.style.display = 'none'
    noIcon.style.display = 'flex'
    glow.style.opacity = '0'
    bgBlur.style.opacity = '0'
    resetAccent()
  }
}

// ── Transport ─────────────────────────────────────────────────────────────────
function togglePlay() {
  if (currentIdx === -1 && filtered.length) { loadAndPlay(0); return }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  audio.paused ? audio.play() : audio.pause()
}

function nextSong() {
  if (!filtered.length) return
  if (shuffle) {
    if (!shuffleQueue.length) buildShuffleQueue()
    const next = shufflePos + 1
    if (next >= shuffleQueue.length) {
      buildShuffleQueue()
      if (shuffleQueue.length) { shufflePos = 0; loadAndPlay(shuffleQueue[0]) }
    } else {
      shufflePos = next
      loadAndPlay(shuffleQueue[next])
    }
  } else {
    const next = currentIdx + 1
    if (next < filtered.length) loadAndPlay(next)
  }
}

function prevSong() {
  if (!filtered.length) return
  if (audio.currentTime > 3) { audio.currentTime = 0; return }
  if (shuffle && shuffleQueue.length) {
    const prev = shufflePos - 1
    if (prev >= 0) { shufflePos = prev; loadAndPlay(shuffleQueue[prev]) }
  } else {
    const prev = currentIdx - 1
    if (prev >= 0) loadAndPlay(prev)
  }
}

function toggleShuffle() {
  shuffle = !shuffle
  document.getElementById('btn-shuffle').classList.toggle('active', shuffle)
  if (shuffle) buildShuffleQueue()
  else { shuffleQueue = []; shufflePos = -1 }
  if (document.getElementById('queue-panel').classList.contains('open')) renderQueue()
}

function buildShuffleQueue() {
  const indices = filtered.map((_, i) => i)
  // Fisher-Yates
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  // Poner la canción actual al inicio de la cola barajada
  if (currentIdx >= 0) {
    const pos = indices.indexOf(currentIdx)
    if (pos > 0) { indices.splice(pos, 1); indices.unshift(currentIdx) }
    shufflePos = 0
  } else {
    shufflePos = -1
  }
  shuffleQueue = indices
}

function toggleRepeat() {
  repeat = !repeat
  audio.loop = repeat
  document.getElementById('btn-repeat').classList.toggle('active', repeat)
}

// ── Lyrics ────────────────────────────────────────────────────────────────────
const LRC_RE  = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\](.*)/
const META_RE = /^\[(?:ti|ar|al|by|offset|length|re|ve):/i

function parseLrc(text) {
  const lines = []
  for (const raw of text.split('\n')) {
    const t = raw.trim()
    if (META_RE.test(t)) continue
    const m = LRC_RE.exec(t)
    if (!m) continue
    const frac = m[3]
    const ms   = parseInt(frac) * (frac.length === 2 ? 10 : 1)
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + ms / 1000
    const lyric = m[4].trim()
    if (lyric) lines.push({ time, text: lyric, el: null })
  }
  return lines.sort((a, b) => a.time - b.time)
}

function buildLyrics(raw) {
  const inner = document.getElementById('lyrics-inner')
  inner.innerHTML = ''
  curLyric   = -1
  lyricLines = []

  const text = (raw || '').trim()

  if (!text) {
    inner.innerHTML = '<div class="no-lyrics">Sin letra incrustada</div>'
    return
  }

  lyricLines = parseLrc(text)

  // Sin timestamps — mostrar como texto plano
  if (!lyricLines.length) {
    text.split('\n').forEach(line => {
      const t = line.trim()
      if (!t) return
      const d = document.createElement('div')
      d.className = 'lyric-line plain'
      d.textContent = t
      inner.appendChild(d)
    })
    return
  }

  // LRC sincronizada
  inner.appendChild(Object.assign(document.createElement('div'), { style: 'height:45vh' }))
  for (const l of lyricLines) {
    const d = document.createElement('div')
    d.className = 'lyric-line'
    d.textContent = l.text
    d.addEventListener('click', () => { audio.currentTime = l.time })
    inner.appendChild(d)
    l.el = d
  }
  inner.appendChild(Object.assign(document.createElement('div'), { style: 'height:45vh' }))
}

function syncLyrics(t) {
  if (!lyricLines.length) return
  let idx = 0
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i].time <= t) idx = i
    else break
  }
  if (idx === curLyric) return
  curLyric = idx

  lyricLines.forEach((l, i) => {
    const d = l.el; if (!d) return
    const dist = Math.abs(i - idx)
    d.className = 'lyric-line' +
      (i === idx ? ' cur' : dist === 1 ? ' near1' : dist <= 3 ? ' near2' : '')
  })

  const el = lyricLines[idx]?.el
  if (el) {
    const scroll = document.getElementById('lyrics-scroll')
    scroll.scrollTo({ top: el.offsetTop - scroll.clientHeight * 0.55 + el.offsetHeight * 0.5, behavior: 'smooth' })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDur() {
  return isFinite(audio.duration) ? audio.duration : (filtered[currentIdx]?.duration || 0)
}

function fmtTime(s) {
  s = Math.max(0, s || 0)
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// ── Shared helpers ────────────────────────────────────────────────────────────
let _artistsCache = null

const noPersonSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`

function deferImgs(queue) {
  let i = 0
  function batch() {
    const end = Math.min(i + 6, queue.length)
    while (i < end) { const [img, src] = queue[i++]; img.src = src }
    if (i < queue.length) requestAnimationFrame(batch)
  }
  requestAnimationFrame(batch)
}

function switchToSongs(label) {
  document.getElementById('filter-label').textContent = label
  document.getElementById('filter-bar').style.display = 'flex'
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
  document.querySelector('[data-tab="songs"]').classList.add('active')
  document.getElementById('view-artists').style.display = 'none'
  document.getElementById('view-folders').style.display = 'none'
  document.getElementById('view-songs').style.display   = 'flex'
}

// ── Folders ───────────────────────────────────────────────────────────────────
function getFolders() {
  const map = new Map()
  for (const s of allSongs) {
    const parts = s.path.split('\\')
    const name  = parts[parts.length - 2] || 'Raíz'
    const dir   = parts.slice(0, -1).join('\\')
    if (!map.has(dir)) map.set(dir, { name, dir, songs: [], cover: null })
    const f = map.get(dir)
    if (!f.cover && s.cover) f.cover = s.cover
    f.songs.push(s)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function buildFolderList(query = '') {
  const ul     = document.getElementById('folder-list')
  ul.innerHTML = ''
  const q       = (query || '').toLowerCase()
  const folders = getFolders().filter(f => !q || f.name.toLowerCase().includes(q))
  const frag    = document.createDocumentFragment()
  const queue   = []

  for (const folder of folders) {
    const li = document.createElement('li')
    li.className = 'artist-item'

    const avatarDiv = document.createElement('div')
    avatarDiv.className = 'artist-avatar'
    avatarDiv.style.borderRadius = '6px'
    if (folder.cover) {
      const img = document.createElement('img')
      img.alt = ''; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px'
      avatarDiv.appendChild(img)
      queue.push([img, folder.cover])
    } else {
      avatarDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`
    }

    const info = document.createElement('div')
    info.innerHTML = `<div class="artist-name">${esc(folder.name)}</div><div class="artist-count">${folder.songs.length} canción${folder.songs.length !== 1 ? 'es' : ''}</div>`

    li.appendChild(avatarDiv); li.appendChild(info)
    li.addEventListener('click', () => { setFiltered(folder.songs); renderList(); switchToSongs(folder.name) })
    frag.appendChild(li)
  }
  ul.appendChild(frag)
  deferImgs(queue)
}

// ── Artists ───────────────────────────────────────────────────────────────────
function getArtists() {
  if (_artistsCache) return _artistsCache
  const map = new Map()
  for (const s of allSongs) {
    const name = s.artist || 'Desconocido'
    if (!map.has(name)) map.set(name, { name, songs: [], cover: null })
    const a = map.get(name)
    if (!a.cover && s.cover) a.cover = s.cover
    a.songs.push(s)
  }
  _artistsCache = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  return _artistsCache
}

function buildArtistList(query = '') {
  const ul    = document.getElementById('artist-list')
  ul.innerHTML = ''
  const q       = (query || '').toLowerCase()
  const artists = getArtists().filter(a => !q || a.name.toLowerCase().includes(q))
  const frag    = document.createDocumentFragment()
  const queue   = []

  for (const artist of artists) {
    const li = document.createElement('li')
    li.className = 'artist-item'

    const avatarDiv = document.createElement('div')
    avatarDiv.className = 'artist-avatar'
    if (artist.cover) {
      const img = document.createElement('img')
      img.alt = ''; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%'
      avatarDiv.appendChild(img)
      queue.push([img, artist.cover])
    } else { avatarDiv.innerHTML = noPersonSvg }

    const info = document.createElement('div')
    info.innerHTML = `<div class="artist-name">${esc(artist.name)}</div><div class="artist-count">${artist.songs.length} canción${artist.songs.length !== 1 ? 'es' : ''}</div>`

    li.appendChild(avatarDiv); li.appendChild(info)
    li.addEventListener('click', () => { setFiltered(artist.songs); renderList(); switchToSongs(artist.name) })
    frag.appendChild(li)
  }
  ul.appendChild(frag)
  deferImgs(queue)
}

// ── Queue ─────────────────────────────────────────────────────────────────────
function toggleQueue() {
  const panel = document.getElementById('queue-panel')
  if (panel.classList.contains('open')) {
    closeQueue()
  } else {
    renderQueue()
    panel.classList.add('open')
    document.getElementById('btn-queue').classList.add('active')
  }
}

function closeQueue() {
  document.getElementById('queue-panel').classList.remove('open')
  document.getElementById('btn-queue').classList.remove('active')
}

function renderQueue() {
  const ul   = document.getElementById('queue-list')
  const meta = document.getElementById('queue-meta')
  ul.innerHTML = ''

  if (!filtered.length) { meta.textContent = ''; return }

  // En shuffle usamos el orden de la cola barajada
  const useShuffleOrder = shuffle && shuffleQueue.length > 0
  const displayList = useShuffleOrder
    ? shuffleQueue.map(i => filtered[i])
    : filtered
  const cur = useShuffleOrder ? shufflePos : currentIdx

  const total = displayList.length
  meta.textContent = `${total} canción${total !== 1 ? 'es' : ''}`

  const frag   = document.createDocumentFragment()
  const imgQ   = []

  displayList.forEach((s, i) => {
    const isCurrent = i === cur
    const isPast    = i < cur
    const isNext    = i === cur + 1
    // índice real en filtered para loadAndPlay
    const realIdx   = useShuffleOrder ? shuffleQueue[i] : i

    const li = document.createElement('li')
    if (isCurrent) li.classList.add('q-current')
    else if (isPast) li.classList.add('q-past')

    const numDiv = document.createElement('div')
    numDiv.className = 'q-num'
    numDiv.textContent = isCurrent ? '▶' : String(i + 1)

    const thumbDiv = document.createElement('div')
    thumbDiv.className = 'q-thumb'
    const img = document.createElement('img')
    img.alt = ''
    if (s.cover) imgQ.push([img, s.cover])
    thumbDiv.appendChild(img)

    const infoDiv = document.createElement('div')
    infoDiv.className = 'q-info'
    infoDiv.innerHTML = `<div class="q-title">${esc(s.title)}</div><div class="q-artist">${esc(s.artist)}</div>`

    const badge = document.createElement('span')
    badge.className = 'q-badge'
    if (isCurrent)  { badge.classList.add('now');  badge.textContent = 'ahora' }
    else if (isNext){ badge.classList.add('next'); badge.textContent = 'siguiente' }

    li.appendChild(numDiv)
    li.appendChild(thumbDiv)
    li.appendChild(infoDiv)
    if (isCurrent || isNext) li.appendChild(badge)

    li.addEventListener('click', () => { loadAndPlay(realIdx); renderQueue() })
    frag.appendChild(li)
  })

  ul.appendChild(frag)
  deferImgs(imgQ)

  requestAnimationFrame(() => {
    const lis = ul.querySelectorAll('li')
    const activeLi = lis[cur >= 0 ? cur : 0]
    if (activeLi) activeLi.scrollIntoView({ block: 'center' })
  })
}

// ── Start ─────────────────────────────────────────────────────────────────────
api.onLibraryChanged(() => {
  setLibCount('Actualizando…')
  scanLibrary()
})
scanLibrary()
