if (typeof api === 'undefined') {
  document.body.innerHTML = '<div style="color:#fff;padding:2rem;font-family:sans-serif"><h2>Error de inicialización</h2><p>El bridge IPC no cargó. Reinicia la aplicación.</p></div>'
  throw new Error('window.api no definida — preload.js falló')
}

// ── Config ────────────────────────────────────────────────────────────────────
const BAR_COUNT  = 48
const ROW_HEIGHT = 56
const OVERSCAN   = 6
const VOL_BOOST  = 1     // ganancia máxima (100%): más de 1 satura el audio
const $ = id => document.getElementById(id)

// ── Iconos ────────────────────────────────────────────────────────────────────
const I = {
  play:      '<path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/>',
  pause:     '<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7H5.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7h-2.6z"/>',
  note:      '<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>',
  person:    '<path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>',
  disc:      '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 14.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
  search:    '<path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/>',
  heart:     '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>',
  heartFill: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
  volMute:   '<path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>',
  volLow:    '<path d="M7 9v6h4l5 5V4l-5 5H7z"/>',
  volMid:    '<path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>',
  volHigh:   '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>',
  tag:       '<path d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7A1.5 1.5 0 1 1 7 5.5 1.5 1.5 0 0 1 5.5 7z"/>',
  radio:     '<path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 2c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 2.22 1.21 4.15 3 5.19l1-1.74c-1.19-.7-2-1.97-2-3.45 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.48-.81 2.75-2 3.45l1 1.74c1.79-1.04 3-2.97 3-5.19zM12 3C6.48 3 2 7.48 2 13c0 3.7 2.01 6.92 4.99 8.65l1-1.73C5.61 18.53 4 15.96 4 13c0-4.42 3.58-8 8-8s8 3.58 8 8c0 2.96-1.61 5.53-4 6.92l1 1.73c2.99-1.73 5-4.95 5-8.65 0-5.52-4.48-10-10-10z"/>',
}
const svg = (p, s = 16, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="currentColor" width="${s}" height="${s}">${p}</svg>`

// ── Persistencia (localStorage) ───────────────────────────────────────────────
function load(key, def) {
  try { const v = localStorage.getItem('sd.' + key); return v == null ? def : JSON.parse(v) } catch { return def }
}
function save(key, val) {
  try { localStorage.setItem('sd.' + key, JSON.stringify(val)) } catch {}
}

// ── State ─────────────────────────────────────────────────────────────────────
let allSongs    = []
let songByPath  = new Map()
let filtered    = []     // contexto de reproducción actual (lo que suena y su orden)
let currentIdx  = -1
let currentSong = null   // objeto canción activo (sobrevive al re-escaneo)
let playContext = null   // { key, title } de la vista desde la que se reprodujo
let shuffle      = false
let shuffleQueue = []    // indices de filtered[] en orden barajado
let shufflePos   = -1    // posición actual dentro de shuffleQueue
let repeatMode  = 0      // 0 = no, 1 = toda la lista, 2 = una canción
let seeking     = false
let lyricLines  = []
let curLyric    = -1
let view        = { name: 'home' }
let histBack    = []
let histFwd     = []
let viewSongs   = []     // canciones mostradas en la vista de colección
let viewTitle   = ''
let selectedIdx = -1
let libFilter   = load('libFilter', 'all')
let rightMode   = load('rightMode', 'np')   // 'np' | 'queue' | null
let recentPaths = load('recents', [])
let plays       = load('plays', {})     // path → { n: veces escuchada, last: timestamp }
let playLog     = load('playLog', [])   // [[path, timestamp]] de las últimas escuchas
let likedPaths  = new Set(load('liked', []))
let volume      = load('volume', 0.66)
let muted       = false

const SONGS_CTX = { key: 'songs:', title: 'Todas las canciones' }
const LIKED_CTX = { key: 'liked:', title: 'Tus me gusta' }

// ── Audio (Web Audio API) ─────────────────────────────────────────────────────
const audio    = $('audio')
const audioCtx = new AudioContext()
const analyser = audioCtx.createAnalyser()
const gainNode = audioCtx.createGain()
const srcNode  = audioCtx.createMediaElementSource(audio)

analyser.fftSize = 2048
srcNode.connect(analyser)
analyser.connect(gainNode)
gainNode.connect(audioCtx.destination)

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Minúsculas y sin acentos, para que "cancion" encuentre "canción" (y al revés)
function fold(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function fmtTime(s) {
  s = Math.max(0, s || 0)
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function fmtLong(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min ${Math.floor(s % 60)} s`
}

// encodeURI no escapa '#' ni '?', así que un archivo como "Track #1.mp3" no cargaba
function toFileUrl(p) {
  return 'file:///' + p.split('\\').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/')
}

function getDur() {
  return isFinite(audio.duration) ? audio.duration : (currentSong?.duration || 0)
}

function folderName(s) {
  const parts = s.path.split('\\')
  return parts[parts.length - 2] || 'Sin álbum'
}
function splitArtists(a) { return (a || '').split(/\s*,\s*/).filter(Boolean) }
function albumKey(s)     { return (s.album || folderName(s)).toLowerCase() }
function likedSongs()    { return allSongs.filter(s => likedPaths.has(s.path)) }
function nSongs(n)       { return `${n} ${n === 1 ? 'canción' : 'canciones'}` }

function artistLinks(artist) {
  return splitArtists(artist)
    .map(n => `<span class="link" data-artist="${esc(n.toLowerCase())}">${esc(n)}</span>`)
    .join(', ')
}

// ── Carga de metadata bajo demanda ────────────────────────────────────────────
// La caché sólo guarda texto; portadas y letras se leen cuando algo las muestra.
const metaQueue   = []
const metaPending = new Map()
let metaActive    = 0

function ensureMeta(song) {
  if (song.metaLoaded) return Promise.resolve(true)
  let p = metaPending.get(song.path)
  if (p) return p
  p = new Promise(resolve => metaQueue.push({ song, resolve }))
  metaPending.set(song.path, p)
  // Al hacer scroll rápido se descartan las peticiones más viejas (ya no visibles)
  if (metaQueue.length > 120) {
    const old = metaQueue.shift()
    metaPending.delete(old.song.path)
    old.resolve(false)
  }
  pumpMeta()
  return p
}

function pumpMeta() {
  while (metaActive < 6 && metaQueue.length) {
    const { song, resolve } = metaQueue.pop()   // lo más reciente primero
    metaActive++
    api.readMeta(song.path)
      .then(meta => Object.assign(song, meta, { metaLoaded: true }))
      .catch(() => {})
      .finally(() => {
        metaActive--
        metaPending.delete(song.path)
        resolve(!!song.metaLoaded)
        pumpMeta()
      })
  }
}

// ── Portadas perezosas ────────────────────────────────────────────────────────
const lazyObs = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    lazyObs.unobserve(e.target)
    const fn = e.target._lazy
    e.target._lazy = null
    if (fn) fn()
  }
}, { rootMargin: '300px' })

function putImg(el, src) {
  el.classList.remove('ph')
  el.innerHTML = ''
  const img = new Image()
  img.alt = ''; img.draggable = false; img.src = src
  el.appendChild(img)
}

// Pone en `el` la primera portada disponible de `songs`, cargándola cuando el
// elemento entra en pantalla. onCover recibe la portada para sacar su color.
function fillCover(el, songs, icon, onCover) {
  lazyObs.unobserve(el)
  el._lazy = null
  el._mkey = null   // cancela un mosaico que se estuviera cargando en este elemento
  const withCover = songs.find(s => s.cover)
  if (withCover) { putImg(el, withCover.cover); onCover?.(withCover.cover); return }
  el.classList.add('ph')
  el.innerHTML = svg(icon)
  const candidates = songs.slice(0, 3).filter(s => !s.metaLoaded)
  if (!candidates.length) return
  el._lazy = async () => {
    for (const s of candidates) {
      await ensureMeta(s)
      if (s.cover) {
        if (el.isConnected) { putImg(el, s.cover); onCover?.(s.cover) }
        return
      }
    }
  }
  queueMicrotask(() => { if (el._lazy) lazyObs.observe(el) })
}

// ── Mosaico de portadas (playlists de género / estilo) ────────────────────────
// 4 portadas de artistas distintos; si no alcanzan, de álbumes distintos
const mosaicCache = new Map()

function mosaicCandidates(songs) {
  const out = [], artists = new Set(), albums = new Set()
  for (const s of songs) {
    const a = (splitArtists(s.artist)[0] || '').toLowerCase()
    if (artists.has(a)) continue
    artists.add(a); albums.add(albumKey(s)); out.push(s)
    if (out.length >= 12) return out
  }
  for (const s of songs) {
    if (albums.has(albumKey(s))) continue
    albums.add(albumKey(s)); out.push(s)
    if (out.length >= 12) break
  }
  return out
}

function fillMosaic(el, key, songs, color) {
  lazyObs.unobserve(el)
  el._lazy = null
  el._mkey = key
  el.classList.add('mosaic')
  el.classList.remove('m4', 'ph')
  el.style.background = rgb(color)
  const draw = covers => {
    if (el._mkey !== key) return
    el.innerHTML = ''
    el.classList.toggle('m4', covers.length >= 4)
    if (!covers.length) { el.innerHTML = svg(I.tag); return }
    for (const c of covers.slice(0, covers.length >= 4 ? 4 : 1)) {
      const img = new Image()
      img.alt = ''; img.draggable = false; img.src = c
      el.appendChild(img)
    }
  }
  const cached = mosaicCache.get(key)
  if (cached) { draw(cached); return }
  el.innerHTML = svg(I.tag)
  el._lazy = async () => {
    const covers = []
    for (const s of mosaicCandidates(songs)) {
      if (!s.metaLoaded) await ensureMeta(s)
      if (s.cover && !covers.includes(s.cover)) covers.push(s.cover)
      if (covers.length >= 4) break
    }
    if (covers.length >= 4) mosaicCache.set(key, covers)   // con menos se reintenta luego
    draw(covers)
  }
  queueMicrotask(() => { if (el._lazy) lazyObs.observe(el) })
}

// ── Colores a partir de portadas ──────────────────────────────────────────────
const colorCache = new Map()

function coverColor(dataUrl) {
  if (colorCache.has(dataUrl)) return Promise.resolve(colorCache.get(dataUrl))
  return new Promise(resolve => {
    const tmp = new Image()
    tmp.onload = () => {
      const size = 48
      const c  = document.createElement('canvas')
      c.width  = c.height = size
      const cx = c.getContext('2d')
      cx.drawImage(tmp, 0, 0, size, size)
      const px = cx.getImageData(0, 0, size, size).data
      let best = -1, col = [83, 83, 83]
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2]
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if (max < 40 || max > 240) continue
        const l = (max + min) / 510
        const s = max === min ? 0 : (max - min) / (255 * (1 - Math.abs(2 * l - 1)))
        const score = s * (1 - Math.abs(l - 0.55))
        if (score > best) { best = score; col = [r, g, b] }
      }
      colorCache.set(dataUrl, col)
      resolve(col)
    }
    tmp.onerror = () => resolve([83, 83, 83])
    tmp.src = dataUrl
  })
}

// Normaliza la luminosidad para que el texto blanco siempre se lea encima
function tone([r, g, b], light) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  let s = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  if (s > 0.08) s = Math.max(s, 0.4)
  return `hsl(${Math.round(h)} ${Math.round(Math.min(s, 0.65) * 100)}% ${Math.round(light * 100)}%)`
}

// ── Agrupación: artistas y álbumes ────────────────────────────────────────────
let groupsCache = null

function getGroups() {
  if (groupsCache) return groupsCache
  const artists = new Map(), albums = new Map()
  for (const s of allSongs) {
    const names = splitArtists(s.artist)
    for (const n of (names.length ? names : ['Artista desconocido'])) {
      const k = n.toLowerCase()
      if (!artists.has(k)) artists.set(k, { kind: 'artist', key: k, name: n, songs: [] })
      artists.get(k).songs.push(s)
    }
    const ak = albumKey(s)
    if (!albums.has(ak)) albums.set(ak, { kind: 'album', key: ak, name: s.album || folderName(s), artist: names[0] || '', songs: [] })
    albums.get(ak).songs.push(s)
  }
  const UNKNOWN = 'artista desconocido'
  const byName = (a, b) => (a.key === UNKNOWN) - (b.key === UNKNOWN) || a.name.localeCompare(b.name)
  groupsCache = {
    artists, albums,
    artistList: [...artists.values()].sort(byName),
    albumList:  [...albums.values()].sort(byName),
  }
  return groupsCache
}

const groupCtx = g => ({ key: `${g.kind}:${g.key}`, title: g.name })

// ── Géneros y mood (etiquetas de Last.fm) ─────────────────────────────────────
// Cada canción se clasifica con SUS etiquetas en Last.fm; las del artista sólo se
// usan si la canción no trae ningún género (así una cumbia de un artista de
// reggaetón cae en Cumbia y no en Reggaetón).
const GENRES = [
  { id: 'salsa',      name: 'Salsa',             color: [200, 50, 40],  tags: ['salsa', 'salsa romantica', 'salsa romántica', 'salsa dura', 'timba', 'son cubano'] },
  { id: 'cumbia',     name: 'Cumbia',            color: [230, 120, 20], tags: ['cumbia', 'cumbia villera', 'cumbia sonidera', 'tecnocumbia', 'cumbia mexicana', 'cumbia norteña', 'cumbia nortena', 'cumbia andina', 'cumbia colombiana', 'chicha', 'cumbia pop', 'electrocumbia', 'eletrocumbia', 'electro cumbia', 'cumbia electronica', 'cumbia electrónica', 'cumbia rebajada'] },
  { id: 'corridos',   name: 'Corridos',          color: [120, 80, 40],  tags: ['corridos tumbados', 'corridos', 'corrido', 'corridos belicos', 'corridos bélicos', 'corrido tumbado', 'sierreno', 'sierreño', 'tumbado'] },
  { id: 'regional',   name: 'Regional mexicano', color: [30, 120, 60],  tags: ['regional mexicano', 'regional mexican', 'musica mexicana', 'música mexicana', 'banda', 'banda sinaloense', 'norteno', 'norteño', 'grupera', 'grupero', 'mariachi', 'ranchera', 'duranguense', 'tejano', 'tex-mex'] },
  { id: 'reggaeton',  name: 'Reggaetón',         color: [220, 40, 140], tags: ['reggaeton', 'reggaetón', 'regueton', 'perreo', 'dembow', 'urbano latino', 'latin urban', 'neoperreo', 'urbano'] },
  { id: 'trap-latino',name: 'Trap latino',       color: [90, 40, 160],  tags: ['latin trap', 'trap latino', 'trap en español', 'trap en espanol', 'spanish trap', 'argentine trap', 'trap argentino'] },
  { id: 'bachata',    name: 'Bachata',           color: [180, 30, 80],  tags: ['bachata'] },
  { id: 'merengue',   name: 'Merengue',          color: [240, 160, 20], tags: ['merengue'] },
  { id: 'vallenato',  name: 'Vallenato',         color: [140, 110, 30], tags: ['vallenato'] },
  { id: 'pop-latino', name: 'Pop latino',        color: [230, 70, 90],  tags: ['latin pop', 'pop latino', 'pop en español', 'pop en espanol', 'spanish pop', 'mexican pop'] },
  { id: 'rock-es',    name: 'Rock en español',   color: [70, 70, 90],   tags: ['rock en español', 'rock en espanol', 'rock mexicano', 'latin rock', 'rock nacional', 'spanish rock', 'rock argentino', 'rock latino'] },
  { id: 'indie',      name: 'Indie / Folk',      color: [60, 130, 140], tags: ['indie', 'indie pop', 'indie rock', 'bedroom pop', 'indie folk', 'dream pop', 'indie latino', 'alternative', 'alternativo', 'folk', 'contemporary folk'] },
  { id: 'balada',     name: 'Baladas',           color: [150, 60, 110], tags: ['balada', 'baladas', 'ballad', 'bolero', 'balada romantica', 'balada romántica', 'romantica'] },
  { id: 'pop',        name: 'Pop',               color: [40, 110, 220], tags: ['pop', 'dance pop', 'synthpop', 'electropop', 'teen pop', 'pop rock'] },
  { id: 'rock',       name: 'Rock',              color: [110, 30, 30],  tags: ['rock', 'classic rock', 'hard rock', 'alternative rock', 'punk', 'pop punk', 'grunge', 'punk rock'] },
  { id: 'metal',      name: 'Metal',             color: [50, 50, 50],   tags: ['metal', 'heavy metal', 'nu metal', 'metalcore', 'thrash metal'] },
  { id: 'hiphop',     name: 'Hip hop / Rap',     color: [180, 100, 30], tags: ['hip-hop', 'hip hop', 'rap', 'hiphop', 'trap', 'underground hip-hop', 'rap en español'] },
  { id: 'rnb',        name: 'R&B / Soul',        color: [100, 50, 130], tags: ['rnb', 'r&b', 'soul', 'neo-soul', 'contemporary r&b'] },
  { id: 'electronica',name: 'Electrónica',       color: [20, 140, 180], tags: ['electronic', 'edm', 'house', 'techno', 'electro', 'dubstep', 'trance', 'deep house', 'electronica'] },
  { id: 'kpop',       name: 'K-pop',             color: [240, 90, 160], tags: ['k-pop', 'kpop'] },
  { id: 'jazz',       name: 'Jazz',              color: [160, 120, 60], tags: ['jazz'] },
  { id: 'clasica',    name: 'Clásica',           color: [120, 100, 80], tags: ['classical', 'clasica', 'clásica'] },
  // Mood: sólo con etiquetas de la canción (las del artista no dicen nada del mood)
  // alias: palabras con las que se encuentra en el buscador ("canciones tristes" → Triste)
  { id: 'm-bailar',   name: 'Para bailar',       color: [230, 50, 100], mood: true, tags: ['dance', 'party', 'perreo', 'bailable', 'fiesta', 'club'],
    alias: ['bailar', 'bailable', 'bailables', 'fiesta', 'perreo', 'party', 'antro', 'reventon'] },
  { id: 'm-peda',     name: 'Para la peda',      color: [190, 110, 30], mood: true, tags: ['drinking', 'drinking songs', 'borracho'],
    alias: ['peda', 'pisto', 'chupe', 'borracho', 'borrachera', 'cantina', 'cheve', 'cerveza', 'tomar', 'drinking', 'pedo'] },
  { id: 'm-feliz',    name: 'Feliz / Alegre',    color: [235, 180, 30], mood: true, tags: ['happy', 'feel good', 'cheerful', 'fun', 'alegre', 'feliz'],
    alias: ['feliz', 'felices', 'alegre', 'alegres', 'alegria', 'happy', 'contento', 'buena vibra', 'good vibes'] },
  { id: 'm-chill',    name: 'Tranqui',           color: [60, 140, 120], mood: true, tags: ['chill', 'chillout', 'relax', 'relaxing', 'mellow', 'lo-fi', 'lofi', 'calm', 'acoustic'],
    alias: ['tranqui', 'tranquila', 'tranquilas', 'relajada', 'relajante', 'relax', 'chill', 'calma', 'dormir', 'estudiar'] },
  { id: 'm-triste',   name: 'Triste / Despecho', color: [60, 80, 150],  mood: true, tags: ['sad', 'melancholic', 'melancholy', 'heartbreak', 'despecho', 'triste', 'depressing', 'emotional'],
    alias: ['triste', 'tristes', 'tristeza', 'despecho', 'llorar', 'sad', 'desamor', 'ardido', 'ardida', 'dolido', 'melancolica', 'corazon roto', 'depre'] },
  { id: 'm-romance',  name: 'Romántica',         color: [200, 60, 80],  mood: true, tags: ['romantic', 'love', 'love songs', 'romantico', 'romántico', 'amor', 'love song'],
    alias: ['romantica', 'romanticas', 'romance', 'amor', 'enamorado', 'enamorada', 'love', 'cursi'] },
  { id: 'm-energia',  name: 'Con energía',       color: [240, 140, 20], mood: true, tags: ['energetic', 'upbeat', 'workout', 'gym', 'hype'],
    alias: ['energia', 'gym', 'ejercicio', 'motivacion', 'prender', 'animo', 'animada', 'entrenar'] },
]
const GENRE_BY_ID = new Map(GENRES.map(g => [g.id, g]))
const TAG_TO_GENRE = new Map()
for (const g of GENRES) for (const t of g.tags) if (!TAG_TO_GENRE.has(t) || g.mood) TAG_TO_GENRE.set(t, g.id)
// 'perreo' es género (Reggaetón) y mood (Para bailar): se cuenta en ambos
const TAG_EXTRA = new Map([['perreo', 'reggaeton']])
const LATIN_TAGS = new Set(['mexico', 'mexican', 'latin', 'latino', 'spanish', 'español', 'espanol', 'argentina',
  'colombia', 'puerto rico', 'chile', 'peru', 'venezuela', 'en español', 'reggaeton', 'corridos tumbados'])
const LATIN_REMAP = [['rock', 'rock-es'], ['pop', 'pop-latino'], ['hiphop', 'trap-latino']]

// Estilos del modelo de audio (Discogs) → géneros de la app
const AUDIO_STYLE = {
  'Latin---Cumbia': 'cumbia', 'Latin---Porro': 'cumbia',
  'Latin---Salsa': 'salsa', 'Latin---Descarga': 'salsa', 'Latin---Son Montuno': 'salsa', 'Latin---Son': 'salsa',
  'Latin---Guaracha': 'salsa', 'Latin---Mambo': 'salsa', 'Latin---Boogaloo': 'salsa', 'Latin---Pachanga': 'salsa',
  'Latin---Charanga': 'salsa', 'Latin---Cubano': 'salsa', 'Latin---Guaguancó': 'salsa', 'Latin---Afro-Cuban': 'salsa',
  'Latin---Cha-Cha': 'salsa',
  'Latin---Merengue': 'merengue', 'Latin---Vallenato': 'vallenato', 'Latin---Reggaeton': 'reggaeton',
  'Latin---Norteño': 'regional', 'Latin---Ranchera': 'regional', 'Latin---Mariachi': 'regional', 'Latin---Tejano': 'regional',
  'Latin---Bolero': 'balada', 'Pop---Ballad': 'balada', 'Folk, World, & Country---Folk': 'indie',
}
function styleToGenre(name) {
  if (AUDIO_STYLE[name]) return AUDIO_STYLE[name]
  const [parent, style = ''] = name.split('---')
  if (/metal|grind|thrash|doom/i.test(style)) return 'metal'
  if (parent === 'Rock')        return /indie|dream pop|shoegaze|lo-fi/i.test(style) ? 'indie' : 'rock'
  if (parent === 'Hip Hop')     return 'hiphop'
  if (parent === 'Electronic')  return /dance-pop|synth-pop/i.test(style) ? 'pop' : style === 'Hip Hop' ? 'hiphop' : 'electronica'
  if (parent === 'Funk / Soul') return 'rnb'
  if (parent === 'Jazz')        return 'jazz'
  if (parent === 'Classical')   return 'clasica'
  if (parent === 'Pop')         return style === 'Indie Pop' ? 'indie' : style === 'K-pop' ? null : 'pop'
  return null
}
// Ritmos que el audio reconoce con mucha seguridad: mandan sobre el género del artista
const AUDIO_DISTINCT = new Set(['cumbia', 'salsa', 'merengue', 'vallenato', 'regional', 'reggaeton'])
const AUDIO_FAMILY   = { regional: ['corridos'], reggaeton: ['trap-latino', 'pop-latino'] }
const TITLE_HINT = /\b(cumbia|cumbias|salsa|bachata|merengue|vallenato|corrido|corridos)\b/i
const TITLE_HINT_GENRE = { cumbia: 'cumbia', cumbias: 'cumbia', salsa: 'salsa', bachata: 'bachata', merengue: 'merengue',
                           vallenato: 'vallenato', corrido: 'corridos', corridos: 'corridos' }
const AUDIO_CHECKABLE = ['clasica', 'jazz', 'metal', 'electronica', 'salsa', 'cumbia', 'merengue', 'vallenato']
const DANCE_GENRES   = ['cumbia', 'salsa', 'merengue', 'reggaeton', 'bachata']
const AUDIO_MOOD = {
  sad: 'm-triste', melancholic: 'm-triste', romantic: 'm-romance', love: 'm-romance', happy: 'm-feliz', fun: 'm-feliz',
  calm: 'm-chill', relaxing: 'm-chill', soft: 'm-chill', meditative: 'm-chill',
  party: 'm-bailar', groovy: 'm-bailar', energetic: 'm-energia', upbeat: 'm-energia', powerful: 'm-energia',
}
// El modelo de mood da valores bajos (entrenado con música de stock); estos umbrales
// dejan ~10% de la biblioteca en cada uno
const AUDIO_MOOD_MIN = { 'm-chill': 0.08, 'm-energia': 0.2 }
// [clave de lyrics-mood.js, mood, palabras clave por cada 100 palabras para contar]
// Umbrales calibrados con la biblioteca (~15% de canciones por mood)
const LYRIC_MOODS = [
  ['triste', 'm-triste', 2.5], ['romance', 'm-romance', 1.8], ['feliz', 'm-feliz', 0.8],
  ['bailar', 'm-bailar', 1.0], ['peda', 'm-peda', 0.8],
]
const LYRIC_MOOD_IDS = new Set(LYRIC_MOODS.map(([, id]) => id))

const rgb = ([r, g, b]) => `rgb(${r} ${g} ${b})`

const lfm = { ready: false, tracks: {}, artists: {} }   // caché de Last.fm en memoria
const audioFeat = new Map()   // path → { styles, moods, vec } del análisis de audio
let songsByKey  = new Map()   // lfmKey → canciones (para cruzar con "similares")
let genreCache  = null

function normKey(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

// Quita "(feat. X)", "- Remastered 2011", "(En Vivo)"… para encontrarla en Last.fm
function cleanTitle(t) {
  const c = String(t || '')
    .replace(/\s*[([](?:feat|ft|with|con|prod)\.?\s[^)\]]*[)\]]/gi, '')
    .replace(/\s*[([][^)\]]*(?:remaster|en vivo|live|official|video|audio|lyric|letra|visualizer|versi[oó]n)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+[^-]*(?:remaster|en vivo|live|versi[oó]n)[^-]*$/i, '')
    .trim()
  return c || String(t || '')
}

const trackKey = (artist, title) => normKey(artist) + '|' + normKey(cleanTitle(title))

function lookupOf(song) {
  const artist = splitArtists(song.artist)[0]
  if (!artist || !song.title) return null
  const title = cleanTitle(song.title)
  return { key: trackKey(artist, title), akey: normKey(artist), artist, title }
}

function applyTags(song) {
  const q = lookupOf(song)
  song.lfmKey  = q?.key
  song.lfmAkey = q?.akey
  const t = q ? lfm.tracks[q.key] : null
  const a = q ? lfm.artists[q.akey] : null

  // Vector de etiquetas para comparar canciones (radio)
  const vec = new Map()
  const addVec = (tags, w) => { for (const [n, c] of tags || []) vec.set(n, (vec.get(n) || 0) + w * c / 100) }
  addVec(t, 1)
  addVec(a, t?.length ? 0.3 : 0.8)
  song.tagVec = vec

  const score = new Map()
  const addScore = (tags, w, moods) => {
    for (const [n, c] of tags || []) {
      for (const id of [TAG_TO_GENRE.get(n), TAG_EXTRA.get(n)]) {
        if (!id || !!GENRE_BY_ID.get(id).mood !== moods) continue
        score.set(id, Math.max(score.get(id) || 0, w * c / 100))
      }
    }
  }
  addScore(t, 1, false)
  const trackHasGenre = score.size > 0
  if (trackHasGenre) {
    addScore(a, 0.25, false)   // 0.25 nunca llega al umbral: el artista sólo rellena huecos
  } else {
    // Las etiquetas de artista traen mucha basura ("All", "mexico"…) y el género real
    // puede tener poco peso (Espinoza Paz → banda: 5); se escala al mejor género que tenga
    addScore(a, 1, false)
    const top = Math.max(0, ...score.values())
    if (top) for (const [id, v] of score) score.set(id, v / top)
  }

  // El título a veces lo dice ("Baila Esta Cumbia", "Yo No Sé Mañana (salsa)")
  const hint = TITLE_HINT.exec(song.title || '')
  if (hint) {
    const id = TITLE_HINT_GENRE[hint[1].toLowerCase()]
    score.set(id, Math.max(score.get(id) || 0, 0.6))
  }

  // Análisis de audio: distingue una cumbia o una salsa aunque el artista sea de reggaetón
  const af = audioFeat.get(song.path)
  if (af) {
    const au = new Map()
    for (const [name, v] of af.styles) {
      const id = styleToGenre(name)
      if (id) au.set(id, Math.max(au.get(id) || 0, v))
    }
    // Si Last.fm / el título ya dicen un ritmo y el audio lo confirma aunque sea poco,
    // no se agrega otro (el modelo confunde cumbias sonideras con reggaetón)
    const confirmed = [...score.keys()].some(id => AUDIO_DISTINCT.has(id) && (au.get(id) || 0) >= 0.15)
    // Last.fm a veces confunde artistas homónimos (Alex Luna → un cantante de ópera):
    // si el género del artista se oye claramente y el audio no lo detecta, pierde peso
    if (!trackHasGenre)
      for (const id of AUDIO_CHECKABLE)
        if (score.has(id) && (au.get(id) || 0) < 0.05) score.set(id, score.get(id) * 0.2)
    const strong = [...au].filter(([id, v]) => AUDIO_DISTINCT.has(id) && v >= 0.45).map(([id]) => id)
    if (!trackHasGenre && !confirmed && strong.length) {
      const keep = new Set(strong.flatMap(id => [id, ...(AUDIO_FAMILY[id] || [])]))
      for (const [id, v] of score) if (!keep.has(id)) score.set(id, v * 0.2)
    }
    const hasLfm = score.size > 0
    for (const [id, v] of au) {
      if (v < 0.3) continue
      const ok = AUDIO_DISTINCT.has(id) ? !confirmed || score.has(id) || v >= 0.7 : !hasLfm
      if (ok) score.set(id, Math.max(score.get(id) || 0, v))
    }
  }

  // Artista latino: "rock" / "pop" / "rap" se refieren a su versión en español
  if ([...(a || []), ...(t || [])].some(([n]) => LATIN_TAGS.has(n)) ||
      af?.styles.some(([n, v]) => n.startsWith('Latin---') && v >= 0.15)) {
    for (const [from, to] of LATIN_REMAP) {
      if (!score.has(from)) continue
      score.set(to, Math.max(score.get(to) || 0, score.get(from)))
      score.delete(from)
    }
  }
  addScore(t, 1, true)
  // Ánimo por letra: lo más fiable para música en español (un corrido triste suena "alegre")
  const ly = af?.lyr
  if (ly) {
    for (const [key, id, min] of LYRIC_MOODS) {
      const v = ly[key] || 0
      if (v >= min) score.set(id, Math.max(score.get(id) || 0, Math.min(1, 0.4 + 0.15 * v / min)))
    }
  }
  // El ánimo por audio es débil; sólo rellena lo que la letra no puede decir
  // (tranquila / con energía) o canciones sin letra
  if (af) {
    for (const [name, v] of af.moods) {
      const id = AUDIO_MOOD[name]
      if (!id || v < (AUDIO_MOOD_MIN[id] || 0.25) || score.has(id) || (ly && LYRIC_MOOD_IDS.has(id))) continue
      score.set(id, v)
    }
  }
  const dance = Math.max(0, ...DANCE_GENRES.map(id => score.get(id) || 0))
  if (dance >= 0.45) score.set('m-bailar', Math.max(score.get('m-bailar') || 0, 0.3))
  song.genreScore = score
  song.genres = [...score].filter(([id, v]) => v >= (GENRE_BY_ID.get(id).mood ? 0.2 : 0.25))
    .sort((x, y) => y[1] - x[1]).map(([id]) => id)
  song.tagText = song.genres.map(id => GENRE_BY_ID.get(id).name).join(' ') + ' ' + (t || []).map(([n]) => n).join(' ')
}

function reindexTags() {
  songsByKey = new Map()
  for (const s of allSongs) {
    applyTags(s)
    if (!s.lfmKey) continue
    if (!songsByKey.has(s.lfmKey)) songsByKey.set(s.lfmKey, [])
    songsByKey.get(s.lfmKey).push(s)
  }
  genreCache = null
}

function getGenreGroups() {
  if (genreCache) return genreCache
  const map = new Map(GENRES.map(g => [g.id, { ...g, kind: 'genre', key: g.id, songs: [] }]))
  for (const s of allSongs) for (const id of s.genres || []) map.get(id).songs.push(s)
  for (const g of map.values()) g.songs.sort((a, b) => b.genreScore.get(g.id) - a.genreScore.get(g.id))
  const list = [...map.values()].filter(g => g.songs.length).sort((a, b) => b.songs.length - a.songs.length)
  genreCache = { map, genres: list.filter(g => !g.mood), moods: list.filter(g => g.mood) }
  return genreCache
}

// Redibujar toda la biblioteca (miles de filas) tarda más de un segundo: si siguen
// siendo los mismos géneros sólo se actualiza el número de canciones de cada uno
let sidebarGenreIds = ''
function refreshSidebarGenres() {
  const gg = getGenreGroups()
  const list = [...gg.genres, ...gg.moods]
  const ids = list.map(x => x.key).sort().join(',')
  if (ids !== sidebarGenreIds) { renderSidebar(); return }
  for (const x of list) {
    const sub = document.querySelector(`#lib-list li[data-key="genre:${x.key}"] .lib-sub`)
    if (sub) sub.textContent = `${x.mood ? 'Mood' : 'Género'} • ${nSongs(x.songs.length)}`
  }
}

function genresChanged() {
  genreCache = null
  if (libFilter === 'all' || libFilter === 'genre') refreshSidebarGenres()
  const kind = viewKind(view)
  if (kind === 'home') fillGenreShelves()
  else if (view.name === 'genre') openCollection(true)
  if (currentSong) renderNpGenres()
}

// Tareas en segundo plano que comparten la línea de estado de la biblioteca
const bgStatus = { lfm: '', audio: '', radio: '' }
function setBg(key, text) {
  bgStatus[key] = text
  const t = Object.values(bgStatus).filter(Boolean).join(' · ')
  setStatus(t || `${allSongs.length} canciones`)
}

// ── Análisis de audio (proceso aparte) ────────────────────────────────────────
function decodeVec(b64) {
  const bin = atob(b64)
  const v = new Float32Array(bin.length)
  for (let i = 0; i < bin.length; i++) { const x = bin.charCodeAt(i); v[i] = (x > 127 ? x - 256 : x) / 127 }
  return v
}

function setAudioFeat(path, d) {
  if (!d || d.error) audioFeat.delete(path)
  else audioFeat.set(path, { styles: d.styles, moods: d.moods, vec: decodeVec(d.emb), lyr: d.lyr })
}

let audioDirty = 0
async function analyzeAudio(files) {
  const cached = await api.audioCached()
  for (const [p, d] of Object.entries(cached)) setAudioFeat(p, d)
  reindexTags()
  genresChanged()
  const n = await api.audioAnalyze(files)
  if (n) setBg('audio', `Analizando audio… faltan ${n}`)
}

api.onAudioResult(({ path, data }) => {
  setAudioFeat(path, data)
  const s = songByPath.get(path)
  if (s) applyTags(s)
  if (++audioDirty >= 40) { audioDirty = 0; genresChanged() }
})
api.onAudioProgress(m => {
  if (m.type === 'fatal') { console.error('Análisis de audio:', m.error); setBg('audio', 'Análisis de audio no disponible'); return }
  if (m.lyrics) { setBg('audio', `Leyendo letras… faltan ${m.lyrics}`); return }
  if (m.left) { setBg('audio', `Analizando audio… faltan ${m.left}`); return }
  setBg('audio', '')
  audioDirty = 0
  genresChanged()
})

// Clasifica en segundo plano las canciones que aún no tienen etiquetas
let tagRun = 0
async function tagLibrary() {
  const run = ++tagRun
  const [st, cached] = await Promise.all([api.lastfmStatus(), api.lastfmCached()])
  if (run !== tagRun) return
  lfm.ready   = st.hasKey
  lfm.tracks  = cached.tracks
  lfm.artists = cached.artists
  reindexTags()
  genresChanged()
  if (!lfm.ready) return

  const seen = new Set()
  const todo = allSongs.filter(s => s.lfmKey && !(s.lfmKey in lfm.tracks) && !seen.has(s.lfmKey) && seen.add(s.lfmKey))
  for (let i = 0; i < todo.length; i++) {
    if (run !== tagRun) return
    const q = lookupOf(todo[i])
    if (!q || q.key in lfm.tracks) continue
    setBg('lfm', `Géneros (Last.fm) ${i + 1}/${todo.length}`)
    try {
      const r = await api.lastfmTags(q)
      if (!r) { setBg('lfm', ''); return }
      lfm.tracks[q.key]   = r.track
      lfm.artists[q.akey] = r.artist
    } catch (e) {
      setBg('lfm', String(e.message).includes('invalid-key')
        ? 'La API key de Last.fm no es válida'
        : 'Sin conexión con Last.fm')
      return
    }
    for (const s of songsByKey.get(q.key) || []) applyTags(s)
    if (i % 60 === 59) genresChanged()
  }
  if (todo.length) genresChanged()
  setBg('lfm', '')
}

// ── Radio (aleatorio inteligente) ─────────────────────────────────────────────
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w }
  for (const v of b.values()) nb += v * v
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

async function startRadio(seed, { quiet = false } = {}) {
  if (!seed) return
  setBg('radio', 'Armando radio…')
  const list = await similarSongs(seed)
  setBg('radio', '')
  const ctx = { key: 'radio:' + seed.path, title: `Radio de ${seed.title}` }
  if (seed === currentSong) {
    // Sigue sonando la misma canción; sólo cambia lo que viene después
    playContext = ctx
    filtered = [seed, ...list]
    currentIdx = 0
    if (shuffle) buildShuffleQueue()
    markSidebar()
    renderRight()
    updatePlayButtons()
  } else {
    playList([seed, ...list], 0, ctx)
  }
  if (!quiet && rightMode !== 'queue') setRight('queue')
}

// Hasta 50 canciones parecidas a `seed`, en orden barajado ponderado (radio y DJ)
async function similarSongs(seed) {
  const q = lookupOf(seed)
  let sim = null
  if (lfm.ready && q) {
    try {
      if (!(q.key in lfm.tracks)) {
        const r = await api.lastfmTags(q)
        if (r) { lfm.tracks[q.key] = r.track; lfm.artists[q.akey] = r.artist; applyTags(seed) }
      }
      sim = await api.lastfmSimilar(q)
    } catch {}
  }

  const score = new Map()
  const add = (s, v) => { if (s !== seed) score.set(s, (score.get(s) || 0) + v) }

  // 1) Lo que Last.fm dice que escucha la gente junto con esta canción
  if (sim) {
    for (const [a, t, m] of sim.tracks)
      for (const s of songsByKey.get(trackKey(a, t)) || []) add(s, 1 + m)
    const simArtists = new Map(sim.artists.map(([a, m]) => [normKey(a), m]))
    for (const s of allSongs) { const m = simArtists.get(s.lfmAkey); if (m) add(s, 0.4 * m) }
  }
  // 2) Canciones con etiquetas parecidas (mismo género / mood)
  if (seed.tagVec?.size) {
    for (const s of allSongs) {
      if (!s.tagVec?.size) continue
      const c = cosine(seed.tagVec, s.tagVec)
      if (c > 0.3) add(s, 0.8 * c)
    }
  }
  // 3) Canciones que SUENAN parecido (huella del análisis de audio). Se resta la
  // media de la biblioteca para que cuente lo que distingue a cada canción.
  const seedVec = audioFeat.get(seed.path)?.vec
  if (seedVec) {
    const vecs = allSongs.map(s => audioFeat.get(s.path)?.vec)
    const mean = new Float32Array(seedVec.length)
    let n = 0
    for (const v of vecs) if (v) { n++; for (let i = 0; i < v.length; i++) mean[i] += v[i] }
    for (let i = 0; i < mean.length; i++) mean[i] /= n
    const center = v => {
      const c = new Float32Array(v.length)
      let norm = 0
      for (let i = 0; i < v.length; i++) { c[i] = v[i] - mean[i]; norm += c[i] * c[i] }
      norm = Math.sqrt(norm) || 1
      for (let i = 0; i < v.length; i++) c[i] /= norm
      return c
    }
    const cs = center(seedVec)
    allSongs.forEach((s, k) => {
      if (!vecs[k] || s === seed) return
      const cv = center(vecs[k])
      let c = 0
      for (let i = 0; i < cs.length; i++) c += cs[i] * cv[i]
      if (c > 0.3) add(s, 3 * (c - 0.3))
    })
  }
  // 4) Un poco del mismo artista
  for (const s of allSongs) if (s.lfmAkey && s.lfmAkey === seed.lfmAkey) add(s, 0.3)

  let picks = [...score].sort((a, b) => b[1] - a[1]).slice(0, 80)
  if (picks.length < 10) {
    const ak = albumKey(seed)
    for (const s of allSongs) if (albumKey(s) === ak || s.artist === seed.artist) add(s, 0.1)
    picks = [...score].sort((a, b) => b[1] - a[1]).slice(0, 80)
  }
  // Barajado ponderado: lo más parecido tiende a salir antes, pero cada radio es distinta
  return picks.map(([s, v]) => [s, Math.pow(Math.random(), 1 / v)])
    .sort((a, b) => b[1] - a[1]).slice(0, 50).map(([s]) => s)
}

// ── Navegación ────────────────────────────────────────────────────────────────
function viewKey(v) { return `${v.name}:${v.key ?? v.q ?? ''}` }
function viewKind(v) { return v.name === 'home' || v.name === 'lyrics' || v.name === 'search' ? v.name : 'collection' }

function navigate(v) {
  if (viewKey(v) === viewKey(view)) return
  histBack.push(view)
  histFwd = []
  view = v
  renderView()
}

function goBack() {
  if (!histBack.length) return
  histFwd.push(view)
  view = histBack.pop()
  renderView()
}

function goForward() {
  if (!histFwd.length) return
  histBack.push(view)
  view = histFwd.pop()
  renderView()
}

function renderView() {
  const kind = viewKind(view)
  for (const k of ['home', 'search', 'collection', 'lyrics']) $('view-' + k).hidden = k !== kind
  $('btn-home').classList.toggle('active', kind === 'home')
  $('btn-lyrics').classList.toggle('active', kind === 'lyrics')
  $('btn-back').disabled = !histBack.length
  $('btn-fwd').disabled  = !histFwd.length
  if (view.q != null) {
    $('search').value = view.q
    $('search-clear').hidden = false
  } else if (kind !== 'lyrics') {
    $('search').value = ''
    $('search-clear').hidden = true
  }

  if (kind === 'home') buildHome()
  else if (kind === 'search') buildSearch()
  else if (kind === 'collection') openCollection()
  else { curLyric = -1; syncLyrics(audio.currentTime, true) }
  markSidebar()
}

// ── Sidebar: Tu biblioteca ────────────────────────────────────────────────────
function renderSidebar() {
  document.querySelectorAll('.sb-chips .chip').forEach(c =>
    c.classList.toggle('active', c.dataset.filter === libFilter))

  const ul = $('lib-list')
  const keepTop = ul.scrollTop
  ul.innerHTML = ''
  const frag = document.createDocumentFragment()

  const add = (key, nav, title, sub, fillThumb, round) => {
    const li = document.createElement('li')
    li.dataset.key = key
    li.title = title
    const th = document.createElement('div')
    th.className = 'lib-thumb' + (round ? ' round' : '')
    fillThumb(th)
    const tx = document.createElement('div')
    tx.className = 'lib-text'
    tx.innerHTML = `<div class="lib-name">${esc(title)}</div><div class="lib-sub">${esc(sub)}</div>`
    const spk = document.createElement('span')
    spk.className = 'lib-playing'
    spk.innerHTML = svg(I.volMid)
    li.append(th, tx, spk)
    li.addEventListener('click', () => navigate(nav))
    frag.appendChild(li)
  }

  if (libFilter === 'all') {
    add('liked:', { name: 'liked' }, 'Tus me gusta', `Playlist • ${nSongs(likedPaths.size)}`,
      th => { th.classList.add('tile-liked'); th.innerHTML = svg(I.heartFill) })
    add('songs:', { name: 'songs' }, 'Todas las canciones', `Playlist • ${nSongs(allSongs.length)}`,
      th => { th.classList.add('tile-songs'); th.innerHTML = svg(I.note) })
  }

  sidebarGenreIds = ''
  if (libFilter === 'all' || libFilter === 'genre') {
    const gg = getGenreGroups()
    sidebarGenreIds = [...gg.genres, ...gg.moods].map(x => x.key).sort().join(',')
    for (const x of [...gg.genres, ...gg.moods])
      add(`genre:${x.key}`, { name: 'genre', key: x.key }, x.name, `${x.mood ? 'Mood' : 'Género'} • ${nSongs(x.songs.length)}`,
        th => fillMosaic(th, `genre:${x.key}`, x.songs, x.color))
    if (libFilter === 'genre' && !gg.genres.length) {
      const li = document.createElement('li')
      li.className = 'lib-cta'
      li.innerHTML = lfm.ready
        ? '<div class="lib-sub">Clasificando tu música… los géneros irán apareciendo aquí.</div>'
        : '<div class="lib-name">Ordena tu música por género</div><div class="lib-sub">Conecta Last.fm para empezar →</div>'
      if (!lfm.ready) li.addEventListener('click', openSettings)
      frag.appendChild(li)
    }
  }

  const g = getGroups()
  if (libFilter === 'all' || libFilter === 'artist')
    g.artistList.forEach(a => add(`artist:${a.key}`, { name: 'artist', key: a.key }, a.name, 'Artista',
      th => fillCover(th, a.songs, I.person), true))
  if (libFilter === 'all' || libFilter === 'album')
    g.albumList.forEach(a => add(`album:${a.key}`, { name: 'album', key: a.key }, a.name, `Álbum • ${a.artist || 'Varios artistas'}`,
      th => fillCover(th, a.songs, I.disc)))

  ul.appendChild(frag)
  ul.scrollTop = keepTop
  markSidebar()
}

function markSidebar() {
  const vk = viewKey(view)
  document.querySelectorAll('#lib-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.key === vk)
    li.classList.toggle('playing', !!playContext && li.dataset.key === playContext.key)
  })
}

function setStatus(t) { $('lib-status').textContent = t }

// ── Home ──────────────────────────────────────────────────────────────────────
function playButton(cls) {
  const b = document.createElement('button')
  b.className = cls
  b.title = 'Reproducir'
  b.innerHTML = svg(I.play, 22)
  return b
}

function setHomeColor(src) {
  const bg = $('home-bg')
  if (!src) { bg.style.backgroundColor = ''; return }
  coverColor(src).then(c => { bg.style.backgroundColor = tone(c, 0.32) })
}

function makeCard(g) {
  const round = g.kind === 'artist'
  const card = document.createElement('div')
  card.className = 'card'
  card.innerHTML =
    `<div class="card-img-wrap"><div class="card-img${round ? ' round' : ''}"></div></div>` +
    `<div class="card-title">${esc(g.name)}</div>` +
    `<div class="card-sub">${esc(round ? 'Artista' : (g.artist || 'Varios artistas'))}</div>`
  fillCover(card.querySelector('.card-img'), g.songs, round ? I.person : I.disc)
  const btn = playButton('card-play')
  btn.addEventListener('click', e => { e.stopPropagation(); playList(g.songs, null, groupCtx(g)) })
  card.querySelector('.card-img-wrap').appendChild(btn)
  card.addEventListener('click', () => navigate({ name: g.kind, key: g.key }))
  return card
}

function fillShelf(id, groups) {
  const row = $(id)
  row.innerHTML = ''
  row.closest('.shelf').hidden = !groups.length
  const frag = document.createDocumentFragment()
  groups.forEach(g => frag.appendChild(makeCard(g)))
  row.appendChild(frag)
}

function buildHome() {
  const h = new Date().getHours()
  $('home-greeting').textContent =
    h >= 6 && h < 12 ? 'Buenos días' :
    h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches'

  const recents = recentPaths.map(p => songByPath.get(p)).filter(Boolean)
  const tiles = [
    { title: 'DJ Nat', cls: 'tile-dj', html: '<span>DJ</span>',
      open: () => { if (rightMode !== 'dj') setRight('dj') }, play: () => djStart() },
    { title: 'Tus me gusta', cls: 'tile-liked', icon: I.heartFill,
      open: () => navigate({ name: 'liked' }), play: () => playList(likedSongs(), null, LIKED_CTX) },
    { title: 'Todas las canciones', cls: 'tile-songs', icon: I.note,
      open: () => navigate({ name: 'songs' }), play: () => playList(allSongs, null, SONGS_CTX) },
    ...(recents.length ? recents : allSongs).slice(0, 5).map(s => ({
      title: s.title, song: s,
      open: () => navigate({ name: 'album', key: albumKey(s) }),
      play: () => playList(allSongs, allSongs.indexOf(s), SONGS_CTX),
    })),
  ]

  const grid = $('home-tiles')
  grid.innerHTML = ''
  for (const t of tiles) {
    const el = document.createElement('div')
    el.className = 'tile'
    const img = document.createElement('div')
    img.className = 'tile-img'
    if (t.song) fillCover(img, [t.song], I.note)
    else { img.classList.add(t.cls); img.innerHTML = t.html || svg(t.icon) }
    const name = document.createElement('span')
    name.className = 'tile-name'
    name.textContent = t.title
    const btn = playButton('card-play')
    btn.addEventListener('click', e => { e.stopPropagation(); t.play() })
    el.append(img, name, btn)
    el.addEventListener('click', t.open)
    el.addEventListener('mouseenter', () => { if (t.song?.cover) setHomeColor(t.song.cover) })
    grid.appendChild(el)
  }
  setHomeColor(recents.find(s => s.cover)?.cover)

  const g = getGroups()
  const bySize = (a, b) => b.songs.length - a.songs.length
  const recentAlbums = [...new Set(recents.map(albumKey))].map(k => g.albums.get(k)).filter(Boolean)
  fillShelf('home-recent-albums', recentAlbums.slice(0, 12))
  fillGenreShelves()
  fillShelf('home-artists', g.artistList.filter(a => a.name !== 'Artista desconocido').sort(bySize).slice(0, 12))
  fillShelf('home-albums', [...g.albumList].sort(bySize).slice(0, 12))
}

function makeGenreCard(g) {
  const card = document.createElement('div')
  card.className = 'card'
  card.innerHTML =
    `<div class="card-img-wrap"><div class="card-img genre-img" style="background:${rgb(g.color)}">` +
    `<span class="genre-name">${esc(g.name)}</span><div class="genre-art"></div></div></div>` +
    `<div class="card-title">${esc(g.name)}</div><div class="card-sub">${nSongs(g.songs.length)}</div>`
  fillCover(card.querySelector('.genre-art'), g.songs, I.tag)
  const btn = playButton('card-play')
  btn.addEventListener('click', e => { e.stopPropagation(); playList(g.songs, null, groupCtx(g)) })
  card.querySelector('.card-img-wrap').appendChild(btn)
  card.addEventListener('click', () => navigate({ name: g.kind === 'tag' ? 'tag' : 'genre', key: g.key }))
  return card
}

function fillGenreShelves() {
  const gg = getGenreGroups()
  for (const [id, list] of [['home-genres', gg.genres], ['home-moods', gg.moods]]) {
    const row = $(id)
    row.innerHTML = ''
    row.closest('.shelf').hidden = !list.length && (lfm.ready || id === 'home-moods')
    const frag = document.createDocumentFragment()
    list.slice(0, 16).forEach(g => frag.appendChild(makeGenreCard(g)))
    if (!list.length && !lfm.ready && id === 'home-genres') {
      const card = document.createElement('div')
      card.className = 'card'
      card.innerHTML =
        `<div class="card-img-wrap"><div class="card-img genre-img genre-cta"><span class="genre-name">Ordena tu música por género</span></div></div>` +
        `<div class="card-title">Conectar Last.fm</div><div class="card-sub">Géneros, mood y radio</div>`
      card.addEventListener('click', openSettings)
      frag.appendChild(card)
    }
    row.appendChild(frag)
  }
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────
function searchMatches(q) {
  const f = fold(q)
  // Etiquetas de estilo (Last.fm) y géneros detectados: "electrocumbia" → Raymix.
  // Con menos de 3 letras casi cualquier etiqueta coincide, así que no se usan.
  const useTags = f.length >= 3
  const tagHit = tags => useTags && (tags || []).some(([n, c]) => c >= 20 && fold(n).includes(f))
  // Palabras con las que la gente pide un mood: "triste", "canciones tristes", "para la peda"…
  const words = f.split(/\s+/)
  const aliasHit = x => useTags && (x.alias || []).some(a => {
    const fa = fold(a)
    return fa === f || fa.startsWith(f) || (fa.length >= 4 && (words.includes(fa) || f.includes(fa + ' ') || f.endsWith(' ' + fa)))
  })
  const genreHit = s => useTags && (s.genres || []).some(id => {
    const g = GENRE_BY_ID.get(id)
    return fold(g.name).includes(f) || aliasHit(g)
  })
  const songTagHit = s => tagHit(lfm.tracks[s.lfmKey]) || tagHit(lfm.artists[s.lfmAkey]) || genreHit(s)

  const rank = s => {
    const t = fold(s.title)
    return t === f ? 0 : t.startsWith(f) ? 1 : t.includes(f) ? 2
         : fold(s.artist).includes(f) ? 3 : fold(s.album).includes(f) ? 4 : songTagHit(s) ? 5 : -1
  }
  const songs = allSongs.map(s => [s, rank(s)]).filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1]).map(([s]) => s)

  const g = getGroups(), gg = getGenreGroups()
  const byName = list => list.filter(x => fold(x.name).includes(f))
    .sort((a, b) => fold(b.name).startsWith(f) - fold(a.name).startsWith(f) || b.songs.length - a.songs.length)
  const named = byName(g.artistList.filter(a => a.name !== 'Artista desconocido'))
  const tagged = g.artistList.filter(a => !named.includes(a) && tagHit(lfm.artists[normKey(a.name)]))
    .sort((a, b) => b.songs.length - a.songs.length)
  const direct = x => fold(x.name).includes(f) || aliasHit(x)
  const genres = [...gg.genres, ...gg.moods]
    .filter(x => direct(x) || (useTags && x.tags.some(t => fold(t).includes(f))))
    .sort((a, b) => direct(b) - direct(a) || b.songs.length - a.songs.length)
  const moodAlias = genres.find(aliasHit)
  // Playlist del estilo buscado: canciones cuya etiqueta coincide (sin contar el nombre)
  const tagSongs = allSongs.filter(s => tagHit(lfm.tracks[s.lfmKey]) || tagHit(lfm.artists[s.lfmAkey]))
  const exactTag = genres.find(x => x.tags.some(t => fold(t) === f))
  const style = tagSongs.length && !moodAlias && !genres.some(x => fold(x.name) === f) && {
    kind: 'tag', key: f, songs: tagSongs, tags: [],
    name: q.trim().replace(/^./, c => c.toUpperCase()),
    color: exactTag?.color || [90, 90, 90],
  }
  return {
    songs, style, moodAlias,
    genres: style ? [style, ...genres] : genres,
    nameSongs: songs.filter(s => rank(s) < 5).length,
    artists: [...named, ...tagged],
    namedArtists: named.length,
    albums:  byName(g.albumList),
  }
}

// El mejor resultado: lo que se llame así; si nada coincide por nombre, el artista
// cuyo estilo coincide (buscar "electrocumbia" pone a Raymix arriba)
function bestMatch(q, m) {
  const f = fold(q)
  const exact = list => list.find(x => fold(x.name) === f)
  const starts = list => list.find(x => fold(x.name).startsWith(f))
  const song = m.nameSongs ? { kind: 'song', song: m.songs[0] } : null
  // "electrocumbia" / "corridos tumbados" → playlist de ese estilo
  return exact(m.genres) || exact(m.artists.slice(0, m.namedArtists)) || m.moodAlias || m.style ||
         (song && fold(song.song.title).startsWith(f) && song) ||
         m.genres.find(x => fold(x.name).includes(f)) || starts(m.artists.slice(0, m.namedArtists)) ||
         song || m.albums[0] || m.artists[0] || m.genres[0] ||
         (m.songs[0] && { kind: 'song', song: m.songs[0] }) || null
}

const searchCtx = () => ({ key: viewKey(view), title: `Búsqueda "${view.q}"` })

function playSongAlone(s) {
  if (s === currentSong) { togglePlay(); return }
  playList([s], 0, searchCtx())
}

function makeBestCard(b) {
  const el = document.createElement('div')
  el.className = 'best-card'
  const img = document.createElement('div')
  img.className = 'best-img'
  let title, sub, play, open
  if (b.kind === 'song') {
    const s = b.song
    fillCover(img, [s], I.note)
    title = s.title
    sub = `<span class="best-pill">Canción</span> ${artistLinks(s.artist)}`
    play = () => playSongAlone(s)
    open = () => navigate({ name: 'album', key: albumKey(s) })
  } else if (b.kind === 'genre' || b.kind === 'tag') {
    fillMosaic(img, `${b.kind}:${b.key}`, b.songs, b.color)
    title = b.name
    sub = `<span class="best-pill">${b.kind === 'tag' ? 'Estilo' : b.mood ? 'Mood' : 'Género'}</span> ${nSongs(b.songs.length)}`
    play = () => playList(b.songs, null, groupCtx(b))
    open = () => navigate({ name: b.kind, key: b.key })
  } else {
    if (b.kind === 'artist') img.classList.add('round')
    fillCover(img, b.songs, b.kind === 'artist' ? I.person : I.disc)
    title = b.name
    sub = `<span class="best-pill">${b.kind === 'artist' ? 'Artista' : 'Álbum'}</span> ${nSongs(b.songs.length)}`
    play = () => playList(b.songs, null, groupCtx(b))
    open = () => navigate({ name: b.kind, key: b.key })
  }
  const t = document.createElement('div')
  t.className = 'best-title'
  t.textContent = title
  const st = document.createElement('div')
  st.className = 'best-sub'
  st.innerHTML = sub
  const btn = playButton('card-play')
  btn.addEventListener('click', e => { e.stopPropagation(); play() })
  el.append(img, t, st, btn)
  el.addEventListener('click', open)
  return el
}

function searchRow(s) {
  const li = document.createElement('li')
  li.className = 'srow' + (s === currentSong ? ' playing' : '')
  li.dataset.path = s.path
  const th = document.createElement('div')
  th.className = 'srow-thumb'
  fillCover(th, [s], I.note)
  const ov = document.createElement('span')
  ov.className = 'srow-play'
  ov.innerHTML = svg(I.play, 16)
  th.appendChild(ov)
  const tx = document.createElement('div')
  tx.className = 'mini-text'
  tx.innerHTML = `<div class="mini-title">${esc(s.title)}</div><div class="mini-sub">${artistLinks(s.artist)}</div>`
  const end = document.createElement('div')
  end.className = 'srow-end'
  const liked = likedPaths.has(s.path)
  end.innerHTML = `<button class="like-btn srow-like${liked ? ' on' : ''}" title="Me gusta">${svg(liked ? I.heartFill : I.heart)}</button>` +
                  `<span>${s.duration ? fmtTime(s.duration) : ''}</span>`
  li.append(th, tx, end)
  li._song = s
  return li
}

let searchSongs = []
function buildSearch() {
  const q = view.q
  const m = searchMatches(q)
  searchSongs = m.songs
  const best = bestMatch(q, m)
  const none = !best && !m.songs.length

  $('search-top').hidden = none
  const bestBox = $('search-best')
  bestBox.innerHTML = ''
  bestBox.closest('section').hidden = !best
  if (best) bestBox.appendChild(makeBestCard(best))

  $('search-songs-wrap').hidden = !m.songs.length
  $('search-all').hidden = m.songs.length <= 5
  $('search-all').textContent = `Mostrar todas (${m.songs.length})`
  const ul = $('search-songs')
  ul.innerHTML = ''
  m.songs.slice(0, 5).forEach(s => ul.appendChild(searchRow(s)))

  fillShelf('search-artists', m.artists.slice(0, 12))
  fillShelf('search-albums', m.albums.slice(0, 12))
  const gRow = $('search-genres')
  gRow.innerHTML = ''
  gRow.closest('.shelf').hidden = !m.genres.length
  m.genres.slice(0, 12).forEach(g => gRow.appendChild(makeGenreCard(g)))

  $('search-empty').textContent = none ? `No se encontraron resultados para "${q}".` : ''
  $('search-scroll').scrollTop = 0
}

function markSearchRows() {
  document.querySelectorAll('#search-songs .srow').forEach(li =>
    li.classList.toggle('playing', li._song === currentSong))
}

$('search-songs').addEventListener('click', e => {
  const li = e.target.closest('.srow')
  if (!li || e.target.closest('.link')) return
  if (e.target.closest('.srow-like')) { toggleLike(li._song); buildSearchRowsLikes(); return }
  playSongAlone(li._song)
})
$('search-songs').addEventListener('contextmenu', e => {
  const li = e.target.closest('.srow')
  if (!li) return
  e.preventDefault()
  openSongMenu(li._song, e.clientX, e.clientY)
})
$('search-all').addEventListener('click', () => navigate({ name: 'searchall', q: view.q }))

function buildSearchRowsLikes() {
  document.querySelectorAll('#search-songs .srow').forEach(li => {
    const on = likedPaths.has(li._song.path)
    const b = li.querySelector('.srow-like')
    b.classList.toggle('on', on)
    b.innerHTML = svg(on ? I.heartFill : I.heart)
  })
}

// ── Colección (lista de canciones con cabecera) ───────────────────────────────
function collectionFor(v) {
  const g = getGroups()
  switch (v.name) {
    case 'songs':
      return { type: 'Playlist', title: 'Todas las canciones', songs: allSongs, tile: 'tile-songs', icon: I.note, color: [16, 120, 80] }
    case 'liked':
      return { type: 'Playlist', title: 'Tus me gusta', songs: likedSongs(), tile: 'tile-liked', icon: I.heartFill, color: [80, 56, 160],
               empty: 'Las canciones que te gusten aparecerán aquí. Toca el ♥ en cualquier canción para guardarla.' }
    case 'artist': {
      const a = g.artists.get(v.key)
      return a && { type: 'Artista', title: a.name, songs: a.songs, round: true, icon: I.person }
    }
    case 'album': {
      const a = g.albums.get(v.key)
      return a && { type: 'Álbum', title: a.name, sub: a.artist, songs: a.songs, icon: I.disc }
    }
    case 'genre': {
      const x = getGenreGroups().map.get(v.key)
      return x && { type: x.mood ? 'Mood' : 'Género', title: x.name, songs: x.songs, mosaic: `genre:${x.key}`,
                    color: x.color, empty: 'Todavía no hay canciones clasificadas aquí.' }
    }
    case 'tag': {
      const st = searchMatches(v.key).style
      return st && { type: 'Estilo', title: st.name, songs: st.songs, mosaic: `tag:${st.key}`, color: st.color }
    }
    case 'searchall':
      return { type: 'Canciones que coinciden con', title: v.q, songs: searchMatches(v.q).songs, icon: I.search, color: [60, 60, 60],
               empty: `No se encontraron canciones para "${v.q}".` }
  }
}

function setHeroColor(css) {
  $('view-collection').style.setProperty('--hero', css)
}

function openCollection(keepScroll = false) {
  const c = collectionFor(view)
  if (!c) { view = { name: 'home' }; renderView(); return }
  const vk = viewKey(view)
  viewSongs = c.songs
  viewTitle = c.title
  if (!keepScroll) selectedIdx = -1

  $('col-type').textContent = c.type
  const t = $('col-title')
  t.textContent = c.title
  t.className = 'col-title' + (c.title.length > 28 ? ' long' : c.title.length > 14 ? ' mid' : '')
  $('col-sticky-title').textContent = c.title

  const total = c.songs.reduce((a, s) => a + (s.duration || 0), 0)
  $('col-meta').innerHTML =
    (c.sub ? `<b class="link" data-artist="${esc(c.sub.toLowerCase())}">${esc(c.sub)}</b> • ` : '') +
    nSongs(c.songs.length) + (total ? `, ${fmtLong(total)}` : '')

  const cv = $('col-cover')
  cv.className = 'col-cover' + (c.round ? ' round' : '')
  cv.style.background = c.bg || ''
  if (c.mosaic) {
    fillMosaic(cv, c.mosaic, c.songs, c.color)
    setHeroColor(tone(c.color, 0.32))
  } else if (c.tile) {
    lazyObs.unobserve(cv)
    cv.classList.add(c.tile)
    cv.innerHTML = svg(c.icon)
    setHeroColor(tone(c.color, 0.32))
  } else {
    setHeroColor(c.color ? tone(c.color, 0.25) : '#3a3a3a')
    fillCover(cv, c.songs, c.icon, src => coverColor(src).then(col => {
      if (viewKey(view) === vk) setHeroColor(tone(col, 0.32))
    }))
  }

  $('col-empty').textContent = c.songs.length ? '' : (c.empty || 'No hay canciones aquí.')
  $('col-actions').hidden = !c.songs.length
  $('track-head').hidden  = !c.songs.length
  if (!keepScroll) colScroll.scrollTop = 0
  renderList()
  updateSticky()
  updatePlayButtons()
}

// ── Virtual Scroll ────────────────────────────────────────────────────────────
const colScroll = $('col-scroll')
const vsList    = $('song-list')
const vsTop     = document.createElement('div')
const vsBot     = document.createElement('div')
const vsRows    = []
vsList.append(vsTop, vsBot)

let vsStart   = 0
let vsEnd     = 0
let vsPending = false

function vsCalc() {
  const rel   = colScroll.scrollTop - vsList.offsetTop
  const start = Math.max(0, Math.floor(rel / ROW_HEIGHT) - OVERSCAN)
  const end   = Math.min(viewSongs.length, Math.ceil((rel + colScroll.clientHeight) / ROW_HEIGHT) + OVERSCAN)
  return { start, end: Math.max(start, end) }
}

function vsMakeLi() {
  const li = document.createElement('li')
  li.className = 'tr'
  li.innerHTML =
    `<div class="tr-num"><span class="n"></span><span class="eq"><i></i><i></i><i></i></span>${svg(I.play, 14, 'tr-play')}${svg(I.pause, 14, 'tr-pause')}</div>` +
    '<div class="tr-main"><div class="tr-thumb"><img alt="" draggable="false"/></div>' +
    '<div class="tr-text"><div class="tr-title"></div><div class="tr-artist"></div></div></div>' +
    '<div class="tr-album"></div>' +
    '<div class="tr-end"><button class="like-btn tr-like" title="Me gusta"></button><span class="tr-dur"></span></div>'
  li._r = {
    n:      li.querySelector('.n'),
    img:    li.querySelector('img'),
    title:  li.querySelector('.tr-title'),
    artist: li.querySelector('.tr-artist'),
    album:  li.querySelector('.tr-album'),
    like:   li.querySelector('.tr-like'),
    dur:    li.querySelector('.tr-dur'),
  }
  return li
}

function vsUpdateRow(li, i) {
  const s = viewSongs[i]
  const r = li._r
  li.dataset.idx = i
  li.classList.toggle('playing', s === currentSong)
  li.classList.toggle('selected', i === selectedIdx)
  r.n.textContent = i + 1
  if (li._song !== s || li._ver !== s.metaLoaded) {
    li._song = s
    li._ver  = s.metaLoaded
    r.title.textContent = s.title || ''
    r.artist.innerHTML  = artistLinks(s.artist)
    r.album.innerHTML   = `<span class="link" data-album="${esc(albumKey(s))}">${esc(s.album || folderName(s))}</span>`
    r.dur.textContent   = s.duration ? fmtTime(s.duration) : ''
  }
  const liked = likedPaths.has(s.path)
  if (r.like._on !== liked) {
    r.like._on = liked
    r.like.classList.toggle('on', liked)
    r.like.innerHTML = svg(liked ? I.heartFill : I.heart)
  }
  if (r.img._src !== s.cover) {
    r.img._src = s.cover
    if (s.cover) r.img.src = s.cover
    else r.img.removeAttribute('src')
  }
  if (!s.metaLoaded) ensureMeta(s).then(ok => { if (ok) scheduleRender() })
}

function renderList() {
  const { start, end } = vsCalc()
  const count = end - start
  while (vsRows.length < count) { const li = vsMakeLi(); vsList.insertBefore(li, vsBot); vsRows.push(li) }
  while (vsRows.length > count) vsRows.pop().remove()
  vsTop.style.height = (start * ROW_HEIGHT) + 'px'
  vsBot.style.height = (Math.max(0, viewSongs.length - end) * ROW_HEIGHT) + 'px'
  vsRows.forEach((li, j) => vsUpdateRow(li, start + j))
  vsStart = start
  vsEnd   = end
}

function scheduleRender() {
  if (vsPending || viewKind(view) !== 'collection') return
  vsPending = true
  requestAnimationFrame(() => { vsPending = false; renderList(); updateSticky() })
}

function updateSticky() {
  const top = colScroll.scrollTop
  $('col-sticky').classList.toggle('show', top > $('col-hero').offsetHeight)
  $('track-head').classList.toggle('stuck', top + 64 >= vsList.offsetTop - 44)
}

colScroll.addEventListener('scroll', scheduleRender)
window.addEventListener('resize', scheduleRender)

vsList.addEventListener('click', e => {
  const li = e.target.closest('li.tr')
  if (!li) return
  const i = +li.dataset.idx
  if (e.target.closest('.tr-like')) { toggleLike(viewSongs[i]); return }
  if (e.target.closest('.tr-num'))  { playFromView(i); return }
  selectedIdx = i
  renderList()
})
vsList.addEventListener('dblclick', e => {
  const li = e.target.closest('li.tr')
  if (li && !e.target.closest('.tr-like, .link')) playFromView(+li.dataset.idx)
})

// ── Panel derecho: Reproduciendo / Cola ───────────────────────────────────────
function upcoming(n) {
  const out = []
  if (shuffle && shuffleQueue.length) {
    for (let p = shufflePos + 1; p < shuffleQueue.length && out.length < n; p++) out.push(shuffleQueue[p])
  } else {
    for (let i = currentIdx + 1; i < filtered.length && out.length < n; i++) out.push(i)
  }
  return out
}

function miniRow(song, idx, isNow) {
  const li = document.createElement('li')
  li.className = 'mini-row' + (isNow ? ' now' : '')
  const th = document.createElement('div')
  th.className = 'mini-thumb'
  fillCover(th, [song], I.note)
  const tx = document.createElement('div')
  tx.className = 'mini-text'
  tx.innerHTML = `<div class="mini-title">${esc(song.title)}</div><div class="mini-sub">${artistLinks(song.artist)}</div>`
  li.append(th, tx)
  if (idx != null) li.addEventListener('click', () => loadAndPlay(idx))
  return li
}

function renderQueue() {
  const now = $('queue-now'), list = $('queue-list')
  now.innerHTML = ''
  list.innerHTML = ''
  if (currentSong) now.appendChild(miniRow(currentSong, null, true))
  const up = upcoming(50)
  $('queue-next-label').textContent = up.length
    ? `A continuación${playContext ? ' de: ' + playContext.title : ''}`
    : !currentSong ? 'La cola está vacía'
    : repeatMode === 1 ? 'Se repetirá la lista' : 'Después sonarán canciones parecidas'
  const frag = document.createDocumentFragment()
  up.forEach(i => frag.appendChild(miniRow(filtered[i], i)))
  list.appendChild(frag)
}

function renderNpNext() {
  const box = $('np-next')
  box.innerHTML = ''
  const i = upcoming(1)[0]
  $('np-next-card').hidden = i == null
  if (i != null) box.appendChild(miniRow(filtered[i], i))
}

function renderRight() {
  $('right-panel').hidden = !rightMode
  $('btn-np').classList.toggle('active', rightMode === 'np')
  $('btn-queue').classList.toggle('active', rightMode === 'queue')
  $('btn-dj').classList.toggle('active', rightMode === 'dj')
  $('rp-np').hidden    = rightMode !== 'np'
  $('rp-queue').hidden = rightMode !== 'queue'
  $('rp-dj').hidden    = rightMode !== 'dj'
  $('rp-title').textContent = rightMode === 'queue' ? 'Cola'
    : rightMode === 'dj' ? 'DJ Nat'
    : (playContext?.title || currentSong?.album || 'Reproduciendo')
  if (rightMode === 'queue') renderQueue()
  if (rightMode === 'np') renderNpNext()
  if (rightMode === 'dj') renderDjPanel()
  // el panel cambia el ancho de la lista central
  scheduleRender()
}

function setRight(mode) {
  rightMode = rightMode === mode ? null : mode
  save('rightMode', rightMode)
  renderRight()
}

// ── Me gusta ──────────────────────────────────────────────────────────────────
function toggleLike(song) {
  if (!song) return
  if (likedPaths.has(song.path)) likedPaths.delete(song.path)
  else likedPaths.add(song.path)
  save('liked', [...likedPaths])
  updateLikeButtons()
  if (view.name === 'liked') openCollection(true)
  else renderList()
  const sub = document.querySelector('#lib-list li[data-key="liked:"] .lib-sub')
  if (sub) sub.textContent = `Playlist • ${nSongs(likedPaths.size)}`
}

function updateLikeButtons() {
  const on = !!currentSong && likedPaths.has(currentSong.path)
  for (const id of ['bar-like', 'np-like']) {
    const b = $(id)
    b.hidden = !currentSong
    b.classList.toggle('on', on)
    b.innerHTML = svg(on ? I.heartFill : I.heart, 18)
    b.title = on ? 'Quitar de Tus me gusta' : 'Guardar en Tus me gusta'
  }
  $('np-radio').hidden = !currentSong
}

// ── Reproducción ──────────────────────────────────────────────────────────────
function playList(songs, idx, ctx) {
  if (!songs.length) return
  if (dj.on && ctx !== DJ_CTX) djStop()   // elegiste otra cosa: el DJ se retira
  playContext = ctx
  filtered = [...songs]
  if (idx == null || idx < 0) idx = shuffle ? Math.floor(Math.random() * filtered.length) : 0
  currentIdx = idx
  if (shuffle) buildShuffleQueue()
  loadAndPlay(idx)
}

function playFromView(i) {
  const s = viewSongs[i]
  if (!s) return
  const ctx = { key: viewKey(view), title: viewTitle }
  if (s === currentSong && playContext?.key === ctx.key) { togglePlay(); return }
  // Desde la búsqueda sólo suena la canción elegida (los demás resultados no tienen
  // por qué parecerse); al terminar sigue la reproducción automática
  if (view.name === 'searchall') playList([s], 0, ctx)
  else playList(viewSongs, i, ctx)
}

function playCurrentView() {
  if (playContext?.key === viewKey(view) && currentSong) { togglePlay(); return }
  playList(viewSongs, null, { key: viewKey(view), title: viewTitle })
}

function loadAndPlay(idx) {
  if (idx < 0 || idx >= filtered.length) return
  currentIdx  = idx
  currentSong = filtered[idx]
  // Sincronizar posición en cola barajada si shuffle está activo
  if (shuffle && shuffleQueue.length) {
    const pos = shuffleQueue.indexOf(idx)
    if (pos >= 0) shufflePos = pos
  }
  const song = currentSong
  addToRecents(song)
  updateNowPlaying(song)

  $('t-cur').textContent = '0:00'
  $('t-tot').textContent = fmtTime(song.duration)
  seekSlider.set(0)

  if (song.metaLoaded) {
    setCover(song.cover)
    buildLyrics(song.lyrics)
  } else {
    setCover(null)
    buildLyrics('')
    // Directo (sin cola) para que la canción actual no espere a las miniaturas
    api.readMeta(song.path).then(meta => {
      Object.assign(song, meta, { metaLoaded: true })
      if (song !== currentSong) return
      updateNowPlaying(song)
      setCover(meta.cover)
      buildLyrics(meta.lyrics)
      $('t-tot').textContent = fmtTime(getDur())
    }).catch(() => {})
  }

  scheduleRender()   // sólo si la lista está a la vista (forzar el layout aquí costaba ~250 ms)
  if (view.name === 'search') markSearchRows()
  markSidebar()
  renderRight()
  countedSong = null
  // Última canción de la lista: se prepara lo que sigue para que el cambio sea inmediato
  if (dj.on && playContext === DJ_CTX) { if (!upcoming(1).length) djPrepare() }
  else if (!upcoming(1).length && repeatMode !== 1) prefetchRadio(song)

  if (audioCtx.state === 'suspended') audioCtx.resume()
  audio.src = toFileUrl(song.path)
  audio.play().catch(err => {
    // AbortError = se pidió otra canción antes de que ésta empezara (saltar rápido)
    if (err.name === 'AbortError' || song !== currentSong) return
    console.error('Error al reproducir:', song.path, err.message)
    $('bar-song-title').textContent  = '⚠ Error al reproducir'
    $('bar-song-artist').textContent = song.path.split('\\').pop()
  })
}

function updateNowPlaying(song) {
  $('bar-song-title').textContent = song.title
  $('bar-song-artist').innerHTML  = artistLinks(song.artist)
  $('np-title').textContent       = song.title
  $('np-artist').innerHTML        = artistLinks(song.artist)
  document.title = song.artist ? `${song.title} • ${song.artist}` : song.title
  updateLikeButtons()
  updateMediaSession()
  renderNpGenres()
}

// Chips con los géneros de la canción actual (clic → abre el género)
function renderNpGenres() {
  const box = $('np-genres')
  box.innerHTML = (currentSong?.genres || [])
    .map(id => `<button class="g-chip" data-genre="${id}">${esc(GENRE_BY_ID.get(id).name)}</button>`).join('')
}

function setCover(src) {
  for (const id of ['bar-cover', 'np-cover']) {
    const el = $(id)
    if (src) putImg(el, src)
    else { el.classList.add('ph'); el.innerHTML = svg(I.note) }
  }
  const lyr = $('view-lyrics')
  if (src) coverColor(src).then(c => { if (currentSong?.cover === src) lyr.style.backgroundColor = tone(c, 0.36) })
  else lyr.style.backgroundColor = ''
  updateMediaSession()
}

function addToRecents(song) {
  recentPaths = [song.path, ...recentPaths.filter(p => p !== song.path)].slice(0, 30)
  save('recents', recentPaths)
}

function setPlayState(playing) {
  document.body.classList.toggle('is-playing', playing)
  $('icon-play').innerHTML = playing ? I.pause : I.play
  $('btn-play').title = playing ? 'Pausar' : 'Reproducir'
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  updatePlayButtons()
}

function updatePlayButtons() {
  const active = !!playContext && playContext.key === viewKey(view) && !audio.paused
  $('col-play').innerHTML        = svg(active ? I.pause : I.play, 24)
  $('col-sticky-play').innerHTML = svg(active ? I.pause : I.play, 20)
  $('col-shuffle').classList.toggle('active', shuffle)
}

// ── Transport ─────────────────────────────────────────────────────────────────
function togglePlay() {
  if (!currentSong) {
    if (viewKind(view) === 'collection' && viewSongs.length) playCurrentView()
    else playList(allSongs, null, SONGS_CTX)
    return
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  audio.paused ? audio.play().catch(() => {}) : audio.pause()
}

function nextSong() {
  if (!filtered.length) return
  if (shuffle) {
    if (!shuffleQueue.length) buildShuffleQueue()
    const next = shufflePos + 1
    if (next >= shuffleQueue.length) {
      if (repeatMode !== 1) { autoplay(); return }
      buildShuffleQueue()
      if (shuffleQueue.length) { shufflePos = 0; loadAndPlay(shuffleQueue[0]) }
    } else {
      shufflePos = next
      loadAndPlay(shuffleQueue[next])
    }
  } else {
    const next = currentIdx + 1
    if (next < filtered.length) loadAndPlay(next)
    else if (repeatMode === 1) loadAndPlay(0)
    else autoplay()
  }
}

function prefetchRadio(song) {
  const q = lookupOf(song)
  if (!lfm.ready || !q) return
  api.lastfmSimilar(q).catch(() => {})
}

// Se acabó la lista (p. ej. un resultado de búsqueda) y no hay repetición:
// sigue con canciones parecidas a la última, como la reproducción automática de Spotify
let autoplaying = false
async function autoplay() {
  if (dj.on) { djNextBlock(); return }
  if (autoplaying || !currentSong) return
  autoplaying = true
  try {
    await startRadio(currentSong, { quiet: true })
    if (filtered.length > 1) nextSong()
  } finally {
    autoplaying = false
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
    else if (repeatMode === 1) loadAndPlay(filtered.length - 1)
  }
}

function toggleShuffle() {
  shuffle = !shuffle
  $('btn-shuffle').classList.toggle('active', shuffle)
  if (shuffle) buildShuffleQueue()
  else { shuffleQueue = []; shufflePos = -1 }
  updatePlayButtons()
  renderRight()
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
  repeatMode = (repeatMode + 1) % 3
  audio.loop = repeatMode === 2
  const b = $('btn-repeat')
  b.classList.toggle('active', repeatMode > 0)
  b.classList.toggle('one', repeatMode === 2)
  b.title = ['Activar repetición', 'Repetir una canción', 'Desactivar repetición'][repeatMode]
}

// ── Historial de escucha ──────────────────────────────────────────────────────
// Una canción cuenta como escuchada a los 30 s (o a la mitad si es más corta)
let countedSong = null

function countPlay(song) {
  const p = plays[song.path] || (plays[song.path] = { n: 0, last: 0 })
  p.n++
  p.last = Date.now()
  playLog.push([song.path, p.last])
  if (playLog.length > 600) playLog = playLog.slice(-600)
  save('plays', plays)
  save('playLog', playLog)
}

// Qué tanto la escuchas últimamente (las escuchas viejas pesan menos)
function affinity(s) {
  const p = plays[s.path]
  return p ? p.n * Math.exp(-(Date.now() - p.last) / (21 * 864e5)) : 0
}

function weightedPick(items, weight) {
  const ws = items.map(weight)
  let r = Math.random() * ws.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}

// ── DJ ────────────────────────────────────────────────────────────────────────
// Arma bloques de canciones según tus gustos, la hora y el día, y entre bloques
// habla. Con Gemini escribe lo que dice y entiende peticiones; sin Gemini usa
// frases armadas y palabras clave. La voz es Gemini (Laomedeia) o la de Windows.
const DJ_CTX = { key: 'dj:', title: 'DJ Nat' }
const dj = {
  on: false, ai: false, vibe: null, recent: [], next: null, prep: null,
  log: [], thinking: false, speaking: false,
}
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function timeBoost(id) {
  const d = new Date(), h = d.getHours(), wd = d.getDay()
  const night   = h >= 21 || h < 4
  const party   = (wd === 5 || wd === 6) && (h >= 19 || h < 4)
  const morning = h >= 6 && h < 12
  let b = 1
  if (night && ['m-triste', 'm-romance', 'm-chill'].includes(id)) b *= 1.6
  if (party && ['m-bailar', 'm-peda', 'reggaeton', 'cumbia'].includes(id)) b *= 1.8
  if (morning && ['m-feliz', 'm-energia', 'm-chill'].includes(id)) b *= 1.5
  return b
}

// Una vibra es un género, a veces combinado con un mood ("Corridos · Triste / Despecho").
// Los moods solos mezclan estilos que no pegan entre sí, por eso siempre van con un género.
function pickVibe(exclude = []) {
  const gg = getGenreGroups()
  const score = songs => { let a = 0; for (const s of songs) a += affinity(s); return 1 + a }
  const genres = gg.genres.filter(g => g.songs.length >= 8 && !exclude.includes(g.key))
  if (!genres.length) return null
  const genre = weightedPick(genres, g => score(g.songs) * timeBoost(g.key) * (dj.recent.includes(g.key) ? 0.15 : 1))
  const inGenre = new Set(genre.songs)
  const combos = gg.moods.map(m => ({ m, songs: m.songs.filter(s => inGenre.has(s)) })).filter(c => c.songs.length >= 6)
  // Con mood la mitad de las veces, o casi siempre si la hora pide uno (noche → triste…)
  if (combos.length && Math.random() < 0.5 + 0.2 * Math.max(...combos.map(c => timeBoost(c.m.key) - 1))) {
    const c = weightedPick(combos, c => score(c.songs) * timeBoost(c.m.key))
    const key = `${genre.key}+${c.m.key}`
    if (!exclude.includes(key)) return { key, name: `${genre.name} · ${c.m.name}`, songs: c.songs, color: genre.color }
  }
  return genre
}

const forgotten = s => (likedPaths.has(s.path) || plays[s.path]?.n >= 3) && Date.now() - (plays[s.path]?.last || 0) > 30 * 864e5

// 5–6 canciones: lo que más te late de ese pool, alguna olvidada, máximo 2 por artista
function buildBlock(pool, n = 5) {
  const t = Date.now() - 3 * 36e5
  const recent = new Set(playLog.filter(([, ts]) => ts > t).map(([p]) => p))
  let cands = pool.filter(s => s !== currentSong && !recent.has(s.path))
  if (cands.length < n) cands = pool.filter(s => s !== currentSong)
  const out = [], perArtist = new Map()
  // Si el pool es de pocos artistas (p. ej. "pon a Kevin Kaarl") se permiten más por artista
  const artists = new Set(cands.map(s => splitArtists(s.artist)[0] || ''))
  const cap = Math.max(2, Math.ceil(n / artists.size))
  while (out.length < n && cands.length) {
    const s = weightedPick(cands, x => 1 + 2 * Math.log1p(affinity(x)) + (likedPaths.has(x.path) ? 1 : 0) + (forgotten(x) ? 2 : 0))
    cands = cands.filter(x => x !== s)
    const a = splitArtists(s.artist)[0] || ''
    if ((perArtist.get(a) || 0) >= cap) continue
    perArtist.set(a, (perArtist.get(a) || 0) + 1)
    out.push(s)
  }
  // Arranca con una conocida
  out.sort((a, b) => affinity(b) - affinity(a))
  return out
}

function topArtistWeek() {
  const t = Date.now() - 7 * 864e5, count = new Map()
  for (const [p, ts] of playLog) {
    if (ts < t) continue
    const a = splitArtists(songByPath.get(p)?.artist)[0]
    if (a) count.set(a, (count.get(a) || 0) + 1)
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

function blockFacts(block) {
  const first = block.songs[0], p = plays[first.path]
  const old = block.songs.find(forgotten)
  return {
    vibra: block.vibe.name.replace(' · ', ' con mood '),
    primera_cancion: cleanTitle(first.title), primer_artista: splitArtists(first.artist)[0] || '',
    // Sólo si hay historial: sin él la IA cree que 0 = "nunca la has oído"
    veces_que_la_has_escuchado: p?.n >= 2 ? p.n : undefined,
    otros_artistas: [...new Set(block.songs.slice(1).map(s => splitArtists(s.artist)[0]).filter(Boolean))].slice(0, 3),
    artista_que_mas_escuchas_esta_semana: topArtistWeek(),
    cancion_que_no_escuchas_hace_mucho: old && old !== first ? `${cleanTitle(old.title)} de ${splitArtists(old.artist)[0]}` : null,
  }
}

const DJ_SYSTEM =
  'Eres la voz que presenta la música en el reproductor personal del usuario, como una locutora de radio mexicana ' +
  'joven: cálida, carismática y con jerga mexicana natural (la neta, va, ¿a poco no?), sin exagerar. ' +
  'Te llamas DJ Nat. Reglas: de 1 a 2 frases y máximo 25 palabras. Se escribe "rola" (con una sola ele). ' +
  'NO te presentes ni digas tu nombre (nada de "soy DJ Nat", "aquí tu…") salvo que la tarea lo pida. NO saludes ni digas la hora o el día, salvo que la tarea lo pida. Ve directo a la música. ' +
  'Usa sólo los datos que te dan; no inventes canciones, artistas ni datos. Sin emojis, comillas, asteriscos ni ' +
  'listas. Háblale de tú. Varía tus frases: no empieces siempre igual.'

const DJ_TASK = {
  welcome: 'El usuario acaba de abrir la app. Salúdalo con el saludo y su nombre (si lo hay), preséntate ("soy DJ Nat"), dile la hora en palabras ' +
           '(ej. "son las once y media"), y dile que empiezan con una playlist que le hiciste, mencionando la vibra y la ' +
           'primera rola. Máximo 30 palabras.',
  intro:   'Es la primera canción de la sesión: un saludo muy corto (dos o tres palabras) y presenta el bloque.',
  next:    'Haz la transición al siguiente bloque como en la radio, sin saludar.',
  switch:  'El usuario pidió cambiar de vibra. Confírmalo con buena onda y presenta el nuevo bloque, sin saludar.',
}

const DJ_TEMPLATES = {
  welcome: [
    '{saludo}{nombre}. Soy DJ Nat y son las {hora}. Empecemos con una playlist que te hice: {vibra}, y abre {artista}.',
  ],
  intro: [
    '¡Qué onda! Vamos a arrancar con {vibra}, y para abrir, {artista}.',
    'Va, hoy toca {vibra}. Empezamos con {cancion} de {artista}.',
  ],
  next: [
    'Va, cambiamos tantito el rollo: ahora {vibra}. Arrancamos con {artista}.',
    'Seguimos. Lo que sigue es {vibra}, y abre {artista} con {cancion}.',
    'Ahí te va un bloque de {vibra}. Empezamos con {artista}, ¿a poco no?',
  ],
  switch: [
    '¡Sale! Otra vibra: {vibra}. Va {artista}.',
    'Entendido, cambiamos. Ahora, {vibra}, con {cancion} de {artista}.',
  ],
}

function templateLine(kind, f) {
  const list = DJ_TEMPLATES[kind] || DJ_TEMPLATES.next
  return list[Math.floor(Math.random() * list.length)]
    .replace('{vibra}', f.vibra.toLowerCase()).replace('{artista}', f.primer_artista)
    .replace('{cancion}', f.primera_cancion).replace('{dia}', f.dia)
    .replace('{saludo}', f.saludo || '¡Hola').replace('{nombre}', f.nombre ? `, ${f.nombre}` : '').replace('{hora}', f.hora || '')
}

// Lo que escribe la IA antes de pasarlo a voz: sin comillas ni asteriscos, "rola" bien escrito
function cleanLine(t) {
  return String(t).replace(/[*"“”]/g, '').replace(/\brollas?\b/gi, m => m.replace(/ll/i, 'l')).trim()
}

async function djLine(kind, block) {
  const f = blockFacts(block)
  if (kind === 'welcome') {
    // Sólo en la bienvenida: saludo según la hora, nombre y hora exacta
    const d = new Date(), h = d.getHours()
    f.saludo = h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches'
    f.nombre = userName || undefined
    f.hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
    f.dia = DAYS[d.getDay()]
  }
  if (dj.ai) {
    const r = await api.djThink(DJ_SYSTEM, `${DJ_TASK[kind] || DJ_TASK.next}\nDatos: ${JSON.stringify(f)}`)
    if (r.ok) return cleanLine(r.ok)
  }
  return templateLine(kind, f)
}

// Texto → archivo de voz. Laomedeia (Gemini), generada completa y verificada antes de
// sonar; si no sale bien, Dalia (Edge, sin límite). Sin internet, la voz de Windows.
async function djVoice(text) {
  if (dj.ai) {
    const r = await api.djSay(text, 'gemini')
    if (r.ok) return r.ok
  }
  const r = await api.djSay(text, 'dalia')
  return r.ok || null
}

// Mientras el DJ habla la música baja; al terminar sube poco a poco
const musicLevel = () => (muted ? 0 : volume) * VOL_BOOST
function duck(on) {
  const g = gainNode.gain, now = audioCtx.currentTime
  g.cancelScheduledValues(now)
  g.setValueAtTime(g.value, now)
  g.setTargetAtTime(on ? musicLevel() * 0.2 : musicLevel(), now, on ? 0.25 : 0.7)
}

const djAudio = $('dj-voice')
// onNearEnd: se llama cuando a la voz le falta ~1.5 s (ahí entra la música nueva).
// quiet: no se escribe en el chat (las respuestas rápidas "¡Va!")
function speak(text, file, onNearEnd, { quiet = false } = {}) {
  return new Promise(resolve => {
    let done = false, near = false
    const nearEnd = () => { if (!near) { near = true; onNearEnd?.() } }
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(guard)
      djAudio.ontimeupdate = null
      nearEnd()
      dj.speaking = false
      duck(false)
      renderDjPanel()
      resolve()
    }
    const guard = setTimeout(finish, 45000)
    dj.speaking = true
    duck(true)
    if (quiet) renderDjPanel()
    else djSay(text)   // el texto aparece cuando empieza a hablar, no antes
    if (file) {
      djAudio.src = toFileUrl(file)
      djAudio.onended = djAudio.onerror = finish
      djAudio.ontimeupdate = () => { if (djAudio.duration - djAudio.currentTime <= 1.5) nearEnd() }
      djAudio.play().catch(finish)
    } else if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'es-MX'
      u.voice = speechSynthesis.getVoices().find(v => v.lang === 'es-MX') || null
      u.rate = 1.05
      u.onend = u.onerror = finish
      speechSynthesis.speak(u)
    } else {
      finish()
    }
  })
}

// ── Respuestas rápidas: cuando le pides algo, Nat contesta al instante con una de estas
// (ya grabadas) mientras genera y verifica la frase completa, como el DJ de Spotify.
// Frases completas: con una sola palabra ("¡Va!") la voz se inventaba un programa de radio
const ACKS = [
  '¡Va! Dame un segundito y te la pongo.',
  '¡Sale! Ahorita te busco algo bueno.',
  '¡Órale, va! Déjame ver qué tengo por aquí.',
  '¡Claro que sí! Ya te lo estoy buscando.',
]
let acksWarming = false
// Las graba una sola vez (luego quedan en caché para siempre), espaciadas para no chocar
// con el límite de sesiones por minuto de Google
async function warmAcks() {
  if (acksWarming || !dj.ai) return
  acksWarming = true
  for (const a of ACKS) {
    if (await api.djCached(a)) continue
    await api.djSay(a, 'gemini')
    await new Promise(r => setTimeout(r, 25000))
  }
}
async function playAck() {
  if (!dj.ai) return
  const ready = []
  for (const a of ACKS) if (await api.djCached(a)) ready.push(a)
  if (!ready.length) return
  const r = await api.djSay(ready[Math.floor(Math.random() * ready.length)], 'gemini')   // en caché: al instante
  if (r.ok) await speak('', r.ok, null, { quiet: true })
}

function djSay(text) { dj.log.push({ who: 'dj', text }); dj.log = dj.log.slice(-30); renderDjPanel() }

// Pone un bloque como en la radio: primero habla Nat (lo que ya sonaba sigue mientras
// prepara qué decir) y cuando está por terminar entra la primera canción desde abajo.
// ack: respuesta rápida que está sonando; la frase completa espera a que termine.
async function djPlay(block, prepared, ack) {
  dj.on = true
  dj.vibe = block.vibe
  dj.recent = [block.vibe.key, ...dj.recent.filter(k => k !== block.vibe.key)].slice(0, 3)
  dj.next = null
  const ready = prepared && 'file' in prepared
  dj.thinking = !ready
  renderDjPanel()
  const line = prepared?.line ?? await djLine(block.kind, block)
  const file = ready ? prepared.file : await djVoice(line)
  if (ack) await ack
  dj.thinking = false
  if (!dj.on) { renderDjPanel(); return }
  let started = false
  const startMusic = () => {
    if (started || !dj.on) return
    started = true
    playList(block.songs, 0, DJ_CTX)   // entra bajita (la voz la tiene agachada) y sube al terminar
  }
  await speak(line, file, startMusic)
  startMusic()
}

function newBlock(kind, exclude = []) {
  const vibe = pickVibe(exclude)
  return vibe && { kind, vibe, songs: buildBlock(vibe.songs) }
}

let userName    = load('userName', '')

// La primera vez que lo inicias en cada sesión te saluda (hora, tu nombre); luego ya no
let welcomed = false
async function djStart() {
  if (!allSongs.length) return
  dj.recent = []
  const kind = welcomed ? 'intro' : 'welcome'
  welcomed = true
  const block = newBlock(kind)
  if (!block) { djSay('Todavía estoy conociendo tu música. Dame un ratito a que termine de clasificarla.'); return }
  if (rightMode !== 'dj') setRight('dj')
  await djPlay(block)
  warmAcks()
}

function djStop() {
  dj.on = false
  dj.next = null
  dj.vibe = null
  djAudio.pause()
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  dj.speaking = dj.thinking = false
  duck(false)
  renderDjPanel()
}

// Mientras suena la última canción del bloque se prepara el siguiente (frase + voz)
function djPrepare() {
  if (dj.next || dj.prep) return dj.prep
  dj.prep = (async () => {
    const block = newBlock('next', dj.vibe ? [dj.vibe.key] : [])
    if (!block) return
    const line = await djLine('next', block)
    const file = await djVoice(line)
    if (dj.on) dj.next = { block, line, file }
  })().finally(() => { dj.prep = null })
  return dj.prep
}

// Un solo cambio de bloque a la vez: si adelantas canciones o le das "siguiente" varias
// veces mientras Nat prepara el siguiente bloque, no se piden bloques de más
let djChanging = false
async function djChange(fn) {
  if (djChanging) return
  djChanging = true
  try { await fn() } finally { djChanging = false }
}

function djNextBlock() {
  return djChange(async () => {
    if (!dj.next && dj.prep) {
      dj.thinking = true   // te avisa que está preparando lo que sigue
      renderDjPanel()
      await dj.prep
    }
    if (dj.next) { const { block, line, file } = dj.next; await djPlay(block, { line, file }); return }
    const block = newBlock('next', dj.vibe ? [dj.vibe.key] : [])
    if (block) await djPlay(block)
  })
}

function djSwitch() {
  return djChange(async () => {
    const block = newBlock('switch', dj.vibe ? [dj.vibe.key] : [])
    if (block) await djPlay(block, undefined, playAck())
  })
}

// ── Peticiones al DJ ("ponme algo pa la peda pero sin reggaetón") ─────────────
const REQ_SCHEMA = {
  type: 'object',
  properties: {
    reply:      { type: 'string', description: 'Lo que DJ Nat le contesta al usuario en voz alta (1-2 frases)' },
    title:      { type: 'string', description: 'Nombre corto de la vibra que vas a poner' },
    genres:     { type: 'array', items: { type: 'string' }, description: 'ids de géneros a incluir' },
    moods:      { type: 'array', items: { type: 'string' }, description: 'ids de moods a incluir' },
    exclude:    { type: 'array', items: { type: 'string' }, description: 'ids de géneros o moods a evitar' },
    artists:    { type: 'array', items: { type: 'string' }, description: 'artistas a incluir, escritos igual que en la lista' },
    similar_to: { type: 'string', description: 'artista o canción a la que se debe parecer, o vacío' },
  },
  required: ['reply', 'title'],
}

function catalogText() {
  const gg = getGenreGroups()
  const groups = [...gg.genres, ...gg.moods].map(g => `${g.key} (${g.name}, ${g.songs.length})`).join('; ')
  const artists = getGroups().artistList.filter(a => a.name !== 'Artista desconocido')
    .sort((a, b) => b.songs.length - a.songs.length).slice(0, 150).map(a => a.name).join(', ')
  return `Géneros y moods disponibles (id, nombre, canciones): ${groups}\nArtistas del usuario: ${artists}`
}

// Sin IA: busca géneros, moods y artistas mencionados; "sin X" excluye y "como X" busca parecidas
function keywordPlan(text) {
  const f = fold(text)
  const [main, ...rest] = f.split(/\b(?:sin|nada de|menos|no quiero)\b/)
  const gg = getGenreGroups()
  const groups = [...gg.genres, ...gg.moods]
  const mentions = seg => groups.filter(g => [g.name, ...(g.alias || []), ...g.tags].some(t => {
    const ft = fold(t)
    return ft.length >= 4 && new RegExp(`\\b${ft.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(seg)
  }))
  const like = /\bcomo\s+(.+)$/.exec(main)
  const head = like ? main.slice(0, like.index) : main
  const inc = mentions(head)
  const artists = getGroups().artistList.filter(a => a.name.length >= 4 && fold(head).includes(fold(a.name))).map(a => a.name)
  const title = [...inc.map(g => g.name), ...artists].join(' + ') || (like ? `Parecido a ${like[1]}` : text)
  return {
    title,
    reply: `¡Va! Te pongo ${title.toLowerCase()}.`,
    genres: inc.filter(g => !g.mood).map(g => g.key),
    moods: inc.filter(g => g.mood).map(g => g.key),
    exclude: rest.flatMap(seg => mentions(seg).map(g => g.key)),
    artists,
    similar_to: like ? like[1].trim() : '',
  }
}

async function poolFromPlan(plan) {
  const gg = getGenreGroups()
  const songsOf = ids => new Set((ids || []).flatMap(id => gg.map.get(id)?.songs || []))
  const known = id => gg.map.has(id)
  let pool = null
  const g = songsOf((plan.genres || []).filter(known)), m = songsOf((plan.moods || []).filter(known))
  if (g.size) pool = g
  if (m.size) {
    const both = pool ? new Set([...pool].filter(s => m.has(s))) : m
    pool = both.size >= 5 ? both : (pool ? new Set([...pool, ...m]) : m)
  }
  // Si pidió artistas, son SUS canciones (filtradas por género/mood sólo si así quedan suficientes)
  const wanted = new Set((plan.artists || []).map(fold))
  if (wanted.size) {
    const bySinger = allSongs.filter(s => splitArtists(s.artist).some(a => wanted.has(fold(a))))
    const both = pool ? bySinger.filter(s => pool.has(s)) : []
    if (bySinger.length) pool = new Set(both.length >= 4 ? both : bySinger)
  }
  if (plan.similar_to) {
    const m2 = searchMatches(plan.similar_to)
    const b = bestMatch(plan.similar_to, m2)
    const seed = b?.kind === 'song' ? b.song : b?.songs ? [...b.songs].sort((x, y) => affinity(y) - affinity(x))[0] : null
    if (seed) {
      const sim = await similarSongs(seed)
      const keep = pool ? sim.filter(s => pool.has(s)) : []
      pool = new Set(keep.length >= 5 ? keep : sim)
    }
  }
  if (!pool) return []
  const ex = new Set((plan.exclude || []).filter(known))
  return [...pool].filter(s => !(s.genres || []).some(id => ex.has(id)))
}

async function djAsk(text) {
  text = text.trim()
  if (!text) return
  dj.log.push({ who: 'yo', text })
  const ack = playAck()
  dj.thinking = true
  renderDjPanel()
  let plan = null
  if (dj.ai) {
    const r = await api.djThink(
      DJ_SYSTEM + ' Ahora el usuario te pide algo: elige qué poner usando SÓLO los ids y artistas de la lista y ' +
      'contéstale directo, sin saludar ni presentarte (ej. "¡Va! Unos corriditos pa la peda, cero reggaetón"). ' +
      'Si pide algo "como", "parecido a" o "tipo" un artista o canción, pon ese nombre en similar_to y NO en artists; ' +
      'usa artists sólo si pide escuchar a ese artista.',
      `${catalogText()}\n\nPetición del usuario: ${text}`, REQ_SCHEMA)
    if (r.ok) plan = r.ok
  }
  if (!plan) plan = keywordPlan(text)
  const pool = await poolFromPlan(plan)
  dj.thinking = false
  if (pool.length < 3) {
    const line = 'Uy, no encontré nada así en tu música. ¿Me lo pides de otra forma?'
    const file = await djVoice(line)
    await ack
    await speak(line, file)
    return
  }
  const block = { kind: 'request', vibe: { key: 'req:' + fold(plan.title || text), name: plan.title || text }, songs: buildBlock(pool, 6) }
  // La respuesta se escribió antes de elegir canciones: se le agrega la que de verdad
  // abre, para que la voz no tenga hueco que rellenar inventando un artista
  const first = block.songs[0], artist = splitArtists(first.artist)[0] || ''
  let line = cleanLine(plan.reply || `¡Va! Te pongo ${block.vibe.name}.`)
  const title = cleanTitle(first.title)
  if (!fold(line).includes(fold(title))) line += ` Arrancamos con ${title}${artist ? ` de ${artist}` : ''}.`
  if (rightMode !== 'dj') setRight('dj')
  await djPlay(block, { line }, ack)
}

// ── Panel del DJ ──────────────────────────────────────────────────────────────
function renderDjPanel() {
  if (rightMode !== 'dj') return
  $('dj-orb').classList.toggle('speaking', dj.speaking)
  $('dj-orb').classList.toggle('thinking', dj.thinking)
  $('dj-vibe').textContent = dj.thinking ? 'Nat está preparando algo…'
    : dj.on && dj.vibe ? `Sonando: ${dj.vibe.name}` : 'DJ Nat, tu DJ personal'
  $('dj-start').textContent = dj.on ? 'Detener DJ' : 'Iniciar DJ'
  $('dj-switch').hidden = !dj.on
  const ul = $('dj-log')
  ul.innerHTML = dj.log.map(m => `<li class="dj-msg ${m.who}">${esc(m.text)}</li>`).join('') ||
    `<li class="dj-empty">${dj.ai
      ? 'Dale a Iniciar DJ, o escríbele lo que se te antoje: "corridos tristes", "algo pa la peda sin reggaetón", "algo como Kevin Kaarl"…'
      : 'Dale a Iniciar DJ. Si conectas Gemini en ajustes, además entiende lo que le escribas y habla con voz natural.'}</li>`
  ul.scrollTop = ul.scrollHeight
}

$('dj-start').addEventListener('click', () => dj.on ? djStop() : djStart())
$('dj-switch').addEventListener('click', djSwitch)
$('btn-dj').addEventListener('click', () => setRight('dj'))
$('dj-ask').addEventListener('submit', e => {
  e.preventDefault()
  const t = $('dj-input').value
  $('dj-input').value = ''
  djAsk(t)
})
api.geminiStatus().then(s => { dj.ai = s.hasKey; renderDjPanel() })

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
    const ms   = Math.round(parseFloat('0.' + m[3]) * 1000)
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + ms / 1000
    const lyric = m[4].trim()
    if (lyric) lines.push({ time, text: lyric, el: null })
  }
  return lines.sort((a, b) => a.time - b.time)
}

function buildLyrics(raw) {
  const inner = $('lyrics-inner')
  inner.innerHTML = ''
  $('lyrics-scroll').scrollTop = 0   // la letra nueva empieza arriba aunque la anterior estuviera abajo
  curLyric   = -1
  lyricLines = []

  const text = (typeof raw === 'string' ? raw : '').trim()

  if (!text) {
    inner.innerHTML = '<div class="no-lyrics">Esta canción no tiene letra.<small>Sólo se muestran letras incrustadas en el MP3 (USLT / LRC).</small></div>'
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
  for (const l of lyricLines) {
    const d = document.createElement('div')
    d.className = 'lyric-line'
    d.textContent = l.text
    d.addEventListener('click', () => { audio.currentTime = l.time; syncLyrics(l.time) })
    inner.appendChild(d)
    l.el = d
  }
}

function syncLyrics(t, instant = false) {
  if (!lyricLines.length) return
  let idx = -1
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i].time <= t) idx = i
    else break
  }
  if (idx === curLyric) return
  curLyric = idx

  lyricLines.forEach((l, i) => {
    l.el.className = 'lyric-line' + (i < idx ? ' past' : i === idx ? ' cur' : '')
  })

  if (view.name !== 'lyrics' || idx < 0) return
  const el = lyricLines[idx].el
  const scroll = $('lyrics-scroll')
  scroll.scrollTo({ top: el.offsetTop - scroll.clientHeight * 0.3, behavior: instant ? 'auto' : 'smooth' })
}

// ── Spectrum ──────────────────────────────────────────────────────────────────
const canvas   = $('spectrum')
const ctx2d    = canvas.getContext('2d')
const fftData  = new Uint8Array(analyser.frequencyBinCount)
const smoothed = new Float32Array(BAR_COUNT)

let _cW = 0, _cH = 0
let spectrumRafId = null

function drawSpectrum() {
  if (audio.paused) {
    ctx2d.clearRect(0, 0, _cW, _cH)
    spectrumRafId = null
    return
  }
  spectrumRafId = requestAnimationFrame(drawSpectrum)

  const W = canvas.offsetWidth
  const H = canvas.offsetHeight
  if (!W || !H) return   // panel cerrado
  if (_cW !== W || _cH !== H) {
    canvas.width = _cW = W
    canvas.height = _cH = H
  }
  ctx2d.clearRect(0, 0, W, H)
  analyser.getByteFrequencyData(fftData)
  ctx2d.fillStyle = '#1ed760'

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
    ctx2d.beginPath()
    ctx2d.roundRect(i * (bw + gap), H - bh, bw, bh, 2)
    ctx2d.fill()
  }
}

// ── Custom sliders ────────────────────────────────────────────────────────────
function makeSlider(trackId, onDrag, onRelease) {
  const track = $(trackId)
  const fill  = $(trackId.replace('track', 'fill'))
  const thumb = $(trackId.replace('track', 'thumb'))
  let dragging = false

  function pctFromEvent(e) {
    const r = track.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }

  function setVisual(pct) {
    fill.style.width = (pct * 100) + '%'
    thumb.style.left = (pct * 100) + '%'
  }

  track.addEventListener('mousedown', e => {
    dragging = true
    track.classList.add('drag')
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
    track.classList.remove('drag')
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
    $('t-cur').textContent = fmtTime(pct * getDur())
  },
  pct => {
    seeking = false
    if (!currentSong) return
    audio.currentTime = pct * getDur()
    syncLyrics(audio.currentTime)
  }
)

// Volumen
const volSlider = makeSlider('vol-track', pct => {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  muted  = false
  volume = pct
  applyVolume()
}, pct => {
  volume = pct
  applyVolume()
  save('volume', volume)
})

function applyVolume() {
  const v = muted ? 0 : volume
  gainNode.gain.value = v * VOL_BOOST
  volSlider.set(v)
  $('btn-mute').innerHTML = svg(v === 0 ? I.volMute : v < 0.34 ? I.volLow : v < 0.67 ? I.volMid : I.volHigh, 18)
  $('btn-mute').title = v === 0 ? 'Activar sonido' : 'Silenciar'
}

function setVolume(v) {
  muted  = false
  volume = Math.max(0, Math.min(1, v))
  applyVolume()
  save('volume', volume)
}

// ── RAF loop (barra fluida a 60fps) ──────────────────────────────────────────
let seekRafId = null

function rafLoop() {
  if (!seeking && !audio.paused && !audio.ended) {
    const dur = getDur()
    if (dur > 0) {
      if (currentSong && countedSong !== currentSong && audio.currentTime >= Math.min(30, dur / 2)) {
        countedSong = currentSong
        countPlay(currentSong)
      }
      seekSlider.set(audio.currentTime / dur)
      $('t-cur').textContent = fmtTime(audio.currentTime)
      syncLyrics(audio.currentTime)
    }
  }
  if (!audio.paused && !audio.ended) {
    seekRafId = requestAnimationFrame(rafLoop)
  } else {
    seekRafId = null
  }
}
// Loop starts from audio 'play' event — not called here directly

// ── Audio events ──────────────────────────────────────────────────────────────
audio.addEventListener('loadedmetadata', () => {
  $('t-tot').textContent = fmtTime(getDur())
})
audio.addEventListener('ended', () => { if (repeatMode !== 2) nextSong() })
audio.addEventListener('play', () => {
  setPlayState(true)
  if (!spectrumRafId) drawSpectrum()
  if (!seekRafId)     rafLoop()
})
audio.addEventListener('pause', () => setPlayState(false))

// ── Media keys / control de Windows (SMTC) ────────────────────────────────────
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !currentSong) return
  const s = currentSong
  navigator.mediaSession.metadata = new MediaMetadata({
    title: s.title, artist: s.artist || '', album: s.album || '',
    artwork: s.cover ? [{ src: s.cover, sizes: '400x400', type: 'image/jpeg' }] : [],
  })
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession
  ms.setActionHandler('play',          () => { if (audio.paused) togglePlay() })
  ms.setActionHandler('pause',         () => audio.pause())
  ms.setActionHandler('previoustrack', prevSong)
  ms.setActionHandler('nexttrack',     () => nextSong())
  ms.setActionHandler('seekto',        d => { audio.currentTime = d.seekTime })
}

// ── Library ───────────────────────────────────────────────────────────────────
async function scanLibrary() {
  setStatus('Cargando biblioteca…')

  const [cache, files] = await Promise.all([api.loadCache(), api.scanMusic()])
  // cache = { version: 1, songs: { path → { title, artist, album, duration, mtime } } }
  // files = [{ path, mtime }]

  const prevMap = songByPath
  const pathSet = new Set(files.map(f => f.path))

  // Remove deleted files from cache
  for (const p of Object.keys(cache.songs)) {
    if (!pathSet.has(p)) delete cache.songs[p]
  }

  // Build allSongs from cache instantly
  allSongs = files.map(({ path: p, mtime }) => {
    const prev = prevMap.get(p)
    if (prev && prev.mtime === mtime) return prev
    const cached = cache.songs[p]
    if (cached && cached.mtime === mtime) {
      return {
        path: p, mtime,
        title: cached.title, artist: cached.artist,
        album: cached.album, duration: cached.duration,
        cover: null, lyrics: ''
      }
    }
    return {
      path: p, mtime,
      title: p.split('\\').pop().replace(/\.mp3$/i, '').replace(/^\d+\s*[-–.]\s*/, ''),
      artist: '', album: '', duration: 0, cover: null, lyrics: ''
    }
  })
  songByPath  = new Map(allSongs.map(s => [s.path, s]))
  groupsCache = null
  refreshLibraryViews()
  setStatus(`${allSongs.length} canciones`)

  // Only read new/modified MP3s, 8 at a time in parallel
  const uncached = files.filter(({ path: p, mtime }) => {
    const c = cache.songs[p]
    return !c || c.mtime !== mtime
  })

  const BATCH = 8
  for (let i = 0; i < uncached.length; i += BATCH) {
    setStatus(`Leyendo metadatos… ${i}/${uncached.length}`)
    await Promise.all(
      uncached.slice(i, i + BATCH).map(async ({ path: p, mtime }) => {
        const meta = await api.readMeta(p)
        const song = songByPath.get(p)
        if (!song) return
        Object.assign(song, meta, { mtime, metaLoaded: true })
        cache.songs[p] = {
          title: meta.title, artist: meta.artist,
          album: meta.album, duration: meta.duration, mtime
        }
        if (song === currentSong) {
          updateNowPlaying(song)
          setCover(meta.cover)
          buildLyrics(meta.lyrics)
        }
      })
    )
    scheduleRender()
  }

  await api.saveCache(cache)

  if (uncached.length) {
    groupsCache = null
    refreshLibraryViews()
  }
  setStatus(`${allSongs.length} canciones`)
  analyzeAudio(files)
  tagLibrary()
}

function refreshLibraryViews() {
  renderSidebar()
  const kind = viewKind(view)
  if (kind === 'home') buildHome()
  else if (kind === 'search') buildSearch()
  else if (kind === 'collection') openCollection(true)
}

// ── Eventos de la UI ──────────────────────────────────────────────────────────
$('btn-min').addEventListener('click',   () => api.winMinimize())
$('btn-max').addEventListener('click',   () => api.winMaximize())
$('btn-close').addEventListener('click', () => api.winClose())

$('btn-play').addEventListener('click',    togglePlay)
$('btn-prev').addEventListener('click',    prevSong)
$('btn-next').addEventListener('click',    () => nextSong())
$('btn-shuffle').addEventListener('click', toggleShuffle)
$('btn-repeat').addEventListener('click',  toggleRepeat)
$('btn-mute').addEventListener('click',    () => {
  if (volume === 0) { volume = 0.5; muted = false }
  else muted = !muted
  applyVolume()
})

$('btn-np').addEventListener('click',      () => setRight('np'))
$('btn-queue').addEventListener('click',   () => setRight('queue'))
$('rp-close').addEventListener('click',    () => setRight(rightMode))
$('np-open-queue').addEventListener('click', () => setRight('queue'))
$('bar-cover').addEventListener('click',   () => setRight('np'))
$('bar-like').addEventListener('click',    () => toggleLike(currentSong))
$('np-like').addEventListener('click',     () => toggleLike(currentSong))

const openCurrentAlbum = () => { if (currentSong) navigate({ name: 'album', key: albumKey(currentSong) }) }
$('bar-song-title').addEventListener('click', openCurrentAlbum)
$('np-title').addEventListener('click',       openCurrentAlbum)

$('btn-lyrics').addEventListener('click', () => {
  if (view.name === 'lyrics') goBack()
  else navigate({ name: 'lyrics' })
})

$('btn-home').addEventListener('click', () => navigate({ name: 'home' }))
$('btn-back').addEventListener('click', goBack)
$('btn-fwd').addEventListener('click',  goForward)

$('col-play').addEventListener('click',        playCurrentView)
$('col-sticky-play').addEventListener('click', playCurrentView)
$('col-shuffle').addEventListener('click',     toggleShuffle)

document.querySelectorAll('.sb-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    libFilter = libFilter === chip.dataset.filter ? 'all' : chip.dataset.filter
    save('libFilter', libFilter)
    renderSidebar()
  })
})

// Links a artista / álbum / género en cualquier parte de la UI
document.addEventListener('click', e => {
  const a = e.target.closest('[data-artist]')
  if (a) { e.stopPropagation(); navigate({ name: 'artist', key: a.dataset.artist }); return }
  const al = e.target.closest('[data-album]')
  if (al) { e.stopPropagation(); navigate({ name: 'album', key: al.dataset.album }); return }
  const ge = e.target.closest('[data-genre]')
  if (ge) { e.stopPropagation(); navigate({ name: 'genre', key: ge.dataset.genre }) }
}, true)

$('np-radio').innerHTML = svg(I.radio, 18)
$('np-radio').addEventListener('click', () => startRadio(currentSong))

// ── Menú contextual (clic derecho en una canción) ────────────────────────────
const ctxMenu = $('ctx-menu')

function openSongMenu(song, x, y) {
  const liked = likedPaths.has(song.path)
  const items = [
    ['radio', 'Iniciar radio (canciones parecidas)'],
    ['like',  liked ? 'Quitar de Tus me gusta' : 'Guardar en Tus me gusta'],
    ...(splitArtists(song.artist).length ? [['artist', 'Ir al artista']] : []),
    ['album', 'Ir al álbum'],
  ]
  const genres = (song.genres || []).map(id => GENRE_BY_ID.get(id).name).join(', ')
  ctxMenu.innerHTML = items.map(([k, t]) => `<button data-act="${k}">${esc(t)}</button>`).join('') +
    `<div class="ctx-info">${genres ? 'Géneros: ' + esc(genres) : (lfm.ready ? 'Sin género detectado' : 'Conecta Last.fm para ver géneros')}</div>`
  ctxMenu._song = song
  ctxMenu.hidden = false
  const r = ctxMenu.getBoundingClientRect()
  ctxMenu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'
  ctxMenu.style.top  = Math.min(y, innerHeight - r.height - 8) + 'px'
}

function closeMenu() { ctxMenu.hidden = true; ctxMenu._song = null }

ctxMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-act]')
  const s = ctxMenu._song
  if (!b || !s) return
  closeMenu()
  if (b.dataset.act === 'radio')  startRadio(s)
  if (b.dataset.act === 'like')   toggleLike(s)
  if (b.dataset.act === 'artist') navigate({ name: 'artist', key: splitArtists(s.artist)[0].toLowerCase() })
  if (b.dataset.act === 'album')  navigate({ name: 'album', key: albumKey(s) })
})

vsList.addEventListener('contextmenu', e => {
  const li = e.target.closest('li.tr')
  if (!li) return
  e.preventDefault()
  selectedIdx = +li.dataset.idx
  renderList()
  openSongMenu(viewSongs[selectedIdx], e.clientX, e.clientY)
})
for (const id of ['bar-cover', 'np-cover']) {
  $(id).addEventListener('contextmenu', e => {
    if (!currentSong) return
    e.preventDefault()
    openSongMenu(currentSong, e.clientX, e.clientY)
  })
}
document.addEventListener('mousedown', e => { if (!ctxMenu.hidden && !ctxMenu.contains(e.target)) closeMenu() })
document.addEventListener('scroll', closeMenu, true)
window.addEventListener('blur', closeMenu)

// ── Ajustes: API key de Last.fm ───────────────────────────────────────────────
function openSettings() {
  $('settings').hidden = false
  $('lfm-msg').textContent = lfm.ready ? 'Last.fm ya está conectado. Pega otra key sólo si quieres cambiarla.' : ''
  $('gem-msg').textContent = dj.ai ? 'Gemini ya está conectado. Pega otra key sólo si quieres cambiarla.' : ''
  $('dj-name').value = userName
  $('lfm-msg').className = $('gem-msg').className = 'modal-msg'
  $('lfm-key').value = $('gem-key').value = ''
  $('lfm-key').focus()
}
function closeSettings() { $('settings').hidden = true }

// Guarda nombre y bienvenida, y sólo las keys que se escribieron (cada una se comprueba antes)
async function saveSettings() {
  userName = $('dj-name').value.trim()
  save('userName', userName)
  const lk = $('lfm-key').value.trim(), gk = $('gem-key').value.trim()
  if (!lk && !gk) { closeSettings(); return }
  $('lfm-save').disabled = true
  let ok = true
  for (const [key, msgId, set, after] of [
    [lk, 'lfm-msg', api.lastfmSetKey, () => tagLibrary()],
    [gk, 'gem-msg', api.geminiSetKey, () => { dj.ai = true; renderDjPanel() }],
  ]) {
    if (!key) continue
    const msg = $(msgId)
    msg.textContent = 'Comprobando…'
    msg.className = 'modal-msg'
    const r = await set(key)
    if (r.ok) { msg.textContent = '¡Conectado!'; after() }
    else { ok = false; msg.textContent = r.error; msg.className = 'modal-msg err' }
  }
  $('lfm-save').disabled = false
  if (ok) closeSettings()
}

$('btn-settings').addEventListener('click', openSettings)
$('lfm-cancel').addEventListener('click', closeSettings)
$('lfm-save').addEventListener('click', saveSettings)
$('lfm-create').addEventListener('click', () => api.openExternal('https://www.last.fm/api/account/create'))
$('gem-create').addEventListener('click', () => api.openExternal('https://aistudio.google.com/apikey'))
for (const id of ['lfm-key', 'gem-key']) {
  $(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') saveSettings()
    if (e.key === 'Escape') closeSettings()
  })
}
$('settings').addEventListener('mousedown', e => { if (e.target === $('settings')) closeSettings() })

// Los botones no se quedan con el foco: así la barra espaciadora no los "pulsa"
document.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault() })

// Botones laterales del mouse (atrás / adelante)
document.addEventListener('mouseup', e => {
  if (e.button === 3) goBack()
  if (e.button === 4) goForward()
})

// ── Búsqueda ──────────────────────────────────────────────────────────────────
let searchTimer = null

$('search').addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const q = $('search').value.trim()
    $('search-clear').hidden = !q
    if (q) {
      if (view.name === 'search') { view = { name: 'search', q }; buildSearch() }
      else navigate({ name: 'search', q })
    } else if (view.name === 'search') {
      goBack()
    }
  }, 250)
})

$('search').addEventListener('keydown', e => {
  if (e.key === 'Enter' && view.name === 'search' && searchSongs.length) playSongAlone(searchSongs[0])
  if (e.key === 'Escape') e.target.blur()
})

$('search-clear').addEventListener('click', e => {
  e.preventDefault()
  $('search').value = ''
  $('search-clear').hidden = true
  if (view.name === 'search') goBack()
})

// ── Atajos de teclado ─────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === 'f' || e.key === 'l' || e.key === 'k')) {
    e.preventDefault()
    $('search').focus()
    $('search').select()
    return
  }
  if (e.target.tagName === 'INPUT') return
  if (e.key === 'Escape' && !ctxMenu.hidden) { closeMenu(); return }
  if (e.key === 'Escape' && !$('settings').hidden) { closeSettings(); return }

  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if (e.ctrlKey && e.key === 'ArrowRight') nextSong()
  else if (e.ctrlKey && e.key === 'ArrowLeft')  prevSong()
  else if (e.ctrlKey && e.key === 'ArrowUp')    { e.preventDefault(); setVolume(volume + 0.1) }
  else if (e.ctrlKey && e.key === 'ArrowDown')  { e.preventDefault(); setVolume(volume - 0.1) }
  else if (e.altKey && e.key === 'ArrowLeft')   goBack()
  else if (e.altKey && e.key === 'ArrowRight')  goForward()
  else if (e.key === 'Enter' && selectedIdx >= 0 && viewKind(view) === 'collection') playFromView(selectedIdx)
})

// ── Start ─────────────────────────────────────────────────────────────────────
setPlayState(false)
applyVolume()
updateLikeButtons()
setCover(null)
buildLyrics('')
renderRight()
renderView()

api.onLibraryChanged(() => {
  setStatus('Actualizando…')
  scanLibrary()
})
scanLibrary()
