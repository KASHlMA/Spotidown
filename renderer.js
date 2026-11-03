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
  if (api.fileUrl) return api.fileUrl(p)   // celular
  return 'file:///' + p.split('\\').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/')
}
const fileName = p => p.split(/[\\/]/).pop()

function getDur() {
  return isFinite(audio.duration) ? audio.duration : (currentSong?.duration || 0)
}

function folderName(s) {
  const parts = s.path.split(/[\\/]/)
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
  // Grabaciones en vivo: se detectan por el título o el álbum ("(En Vivo)", "Live at…"), no por Last.fm
  { id: 'envivo',     name: 'En vivo',           color: [180, 30, 60],  tags: ['en vivo', 'live recording'],
    alias: ['en vivo', 'vivo', 'live', 'concierto', 'conciertos', 'directo'] },
  { id: 'reggaeton',  name: 'Reggaetón',         color: [220, 40, 140], tags: ['reggaeton', 'reggaetón', 'regueton', 'perreo', 'dembow', 'urbano latino', 'latin urban', 'neoperreo', 'urbano'],
    alias: ['bellakeo', 'bellaqueo', 'bellaco', 'bellaca', 'bellakas', 'perrear', 'perreito'] },
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
const LIVE_RE = /\b(en vivo|en directo|ao vivo)\b|[([/]\s*live\b|-\s*live\b|\blive (at|from|in|en|desde)\b/i
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
  // Peso bajo a propósito: "En vivo" no es el género principal (un corrido en vivo sigue siendo corrido)
  if (LIVE_RE.test(song.title || '') || LIVE_RE.test(song.album || '')) score.set('envivo', Math.max(score.get('envivo') || 0, 0.3))
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
function notify(t) { setStatus(t); window.dispatchEvent(new CustomEvent('sd-notify', { detail: t })) }

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

// ── Mixes del día (como los "Mix diario" de Spotify): cambian cada día ─────────
// Mismo día = mismos mixes (azar con semilla de la fecha); al día siguiente, otras canciones
function seeded(seed) {
  let a = 0
  for (const c of seed) a = (a * 31 + c.charCodeAt(0)) | 0
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
let mixCache = null
function dailyMixes() {
  const day = new Date().toLocaleDateString('en-CA')
  // Se vuelven a armar si cambia la biblioteca o llegan los géneros (al abrir la app tardan)
  const sig = allSongs.length + '|' + getGenreGroups().genres.length
  if (mixCache?.day === day && mixCache.sig === sig) return mixCache.mixes
  const rnd = seeded(day)
  const pickN = (pool, n, weight) => {
    const out = [], left = [...new Map(pool.map(s => [songKey(s), s])).values()]
    while (out.length < n && left.length) {
      const ws = left.map(weight), sum = ws.reduce((a, b) => a + b, 0)
      let r = rnd() * sum, i = 0
      while (i < left.length - 1 && (r -= ws[i]) > 0) i++
      out.push(left.splice(i, 1)[0])
    }
    return out
  }
  const artistsOf = songs => [...new Set(songs.flatMap(s => splitArtists(s.artist).slice(0, 1)))].slice(0, 3).join(', ')
  const mixes = []
  // Uno por cada género que más escuchas: tus favoritas pesan más y se cuelan algunas que casi no oyes
  const gg = getGenreGroups()
  const score = g => g.songs.reduce((a, s) => a + affinity(s), 0)
  const top = [...gg.genres].filter(g => g.songs.length >= 15).sort((a, b) => score(b) - score(a)).slice(0, 6)
  top.forEach((g, i) => {
    const songs = pickN(g.songs, 30, s => 1 + Math.log1p(affinity(s)) * 1.5 + (plays[s.path] ? 0 : 0.6))
    mixes.push({ kind: 'mix', key: 'g' + i, name: `Mix de ${g.name}`, songs, artist: artistsOf(songs), color: g.color })
  })
  const never = allSongs.filter(s => !plays[s.path])
  if (never.length >= 10) {
    const songs = pickN(never, 30, () => 1)
    mixes.push({ kind: 'mix', key: 'new', name: 'Descubrimiento del día', songs, artist: 'Canciones tuyas que nunca has escuchado', color: [30, 90, 160] })
  }
  const back = allSongs.filter(forgotten)
  if (back.length >= 8) {
    const songs = pickN(back, 30, s => 1 + Math.log1p(affinity(s)))
    mixes.push({ kind: 'mix', key: 'back', name: 'De vuelta a…', songs, artist: 'Las que te gustaban y ya no pones', color: [150, 90, 30] })
  }
  const t = Date.now() - 30 * 864e5
  const recent = allSongs.filter(s => plays[s.path]?.last > t).sort((a, b) => affinity(b) - affinity(a)).slice(0, 30)
  if (recent.length >= 10) mixes.push({ kind: 'mix', key: 'rep', name: 'Tu repetición', songs: recent, artist: 'Lo que más estás oyendo', color: [120, 30, 120] })
  mixCache = { day, sig, mixes }
  return mixes
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
  fillShelf('home-mixes', dailyMixes())
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
  fillShelf('home-mixes', dailyMixes())   // los mixes de género necesitan los géneros
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
      return { type: 'Playlist', title: 'Todas las canciones', songs: allSongs, tile: 'tile-songs', icon: I.note, color: [150, 20, 30] }
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
    case 'mix': {
      const m = dailyMixes().find(x => x.key === v.key)
      return m && { type: 'Playlist', title: m.name, sub: m.artist, songs: m.songs, mosaic: `mix:${m.key}`, color: m.color }
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

// ── Fila: "Agregar a la fila" (después de las que ya agregaste) y reacomodar ─────
const queued = new Set()   // agregadas con "Agregar a la fila" que todavía no suenan
function addToQueue(song) {
  if (!currentSong) { playList([song], 0, null); return }
  if (shuffle && shuffleQueue.length) {
    filtered.push(song)
    let p = shufflePos + 1
    while (p < shuffleQueue.length && queued.has(filtered[shuffleQueue[p]])) p++
    shuffleQueue.splice(p, 0, filtered.length - 1)
  } else {
    let p = currentIdx + 1
    while (p < filtered.length && queued.has(filtered[p])) p++
    filtered.splice(p, 0, song)
  }
  queued.add(song)
  notify(`Se agregó a la fila: ${song.title}`)
  if (rightMode === 'queue') renderQueue()
  else if (rightMode === 'np') renderNpNext()
}
// Mueve una canción de la fila: from/to son posiciones en lo que sigue (0 = la siguiente)
function moveUpcoming(from, to) {
  if (from === to) return
  if (shuffle && shuffleQueue.length) {
    const base = shufflePos + 1
    const [x] = shuffleQueue.splice(base + from, 1)
    shuffleQueue.splice(base + to, 0, x)
  } else {
    const base = currentIdx + 1
    const [x] = filtered.splice(base + from, 1)
    filtered.splice(base + to, 0, x)
  }
  if (rightMode === 'queue') renderQueue()
}

// ── Apagado automático: la música se pausa sola a los N minutos o al acabar la canción ──
let sleepTimer = null   // { until, t } | { endOfSong: true }
function setSleepTimer(min) {   // 0 = quitar, -1 = al terminar la canción
  clearTimeout(sleepTimer?.t)
  sleepTimer = !min ? null
    : min < 0 ? { endOfSong: true }
    : { until: Date.now() + min * 60000, t: setTimeout(() => { sleepTimer = null; audio.pause() }, min * 60000) }
  notify(!min ? 'Apagado automático desactivado'
    : min < 0 ? 'La música se apaga al terminar esta canción' : `La música se apaga en ${min} min`)
}
const sleepLabel = () => !sleepTimer ? '' : sleepTimer.endOfSong ? 'al terminar la canción'
  : `en ${Math.max(1, Math.round((sleepTimer.until - Date.now()) / 60000))} min`

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
  updateCanvas()
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
  queued.delete(currentSong)
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
  if (dj.on && playContext === DJ_CTX) { if (!upcoming(1).length) djPrepare((song.duration || 0) * 1000) }
  else if (!upcoming(1).length && repeatMode !== 1) prefetchRadio(song)

  if (audioCtx.state === 'suspended') audioCtx.resume()
  audio.src = toFileUrl(song.path)
  audio.play().catch(err => {
    // AbortError = se pidió otra canción antes de que ésta empezara (saltar rápido)
    if (err.name === 'AbortError' || song !== currentSong) return
    console.error('Error al reproducir:', song.path, err.message)
    $('bar-song-title').textContent  = '⚠ Error al reproducir'
    $('bar-song-artist').textContent = fileName(song.path)
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
  updateCanvas()
}

// Chips con los géneros de la canción actual (clic → abre el género)
function renderNpGenres() {
  const box = $('np-genres')
  box.innerHTML = (currentSong?.genres || [])
    .map(id => `<button class="g-chip" data-genre="${id}">${esc(GENRE_BY_ID.get(id).name)}</button>`).join('')
}

// ── Video de fondo (tipo Canvas de Spotify) ───────────────────────────────────
// El video oficial de YouTube sin sonido, en loop, encima de la carátula. Sin internet, sin
// video, o si el video no se deja incrustar, se queda la carátula. Sólo con el panel abierto.
const canvasBox = $('np-canvas')
const canvasState = { song: null, ids: [], i: 0, frame: null }
let canvasOn = load('canvasOn', true)
function canvasCmd(func, args = []) {
  canvasState.frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
}
function canvasClear() {
  canvasHide()
  canvasState.frame?.remove()
  canvasState.frame = null
}
// Loop corto como el Canvas de Spotify: del segundo CANVAS_AT, CANVAS_LEN segundos
const CANVAS_AT = 30, CANVAS_LEN = 9
function canvasMode(on) {
  canvasBox.classList.toggle('on', on)
  $('right-panel').classList.toggle('canvas-mode', on)
  canvasBtn()
}
function canvasShow() {
  // Se muestra un poquito después de que arranca (para que ya esté corriendo)
  clearTimeout(canvasState.showTimer)
  canvasState.showTimer = setTimeout(() => { if (canvasState.frame) canvasMode(true) }, 1500)
}
function canvasHide() { clearTimeout(canvasState.showTimer); canvasMode(false) }
// "Cambiar a video" / "Cambiar a carátula": sólo si la canción tiene video
function canvasBtn() {
  $('np-switch').hidden = !canvasState.ids.length
  $('np-switch-text').textContent = canvasState.userOff ? 'Cambiar a video' : 'Cambiar a carátula'
}
$('np-lyrics').addEventListener('click', () => navigate({ name: 'lyrics' }))
$('np-switch').addEventListener('click', () => {
  canvasState.userOff = !canvasState.userOff
  if (canvasState.userOff) canvasClear()
  else { canvasState.i = 0; canvasTry() }
  canvasBtn()
})

function canvasTry() {
  canvasClear()
  const id = canvasState.ids[canvasState.i]
  if (!id) { canvasState.ids = []; canvasBtn(); return }   // ninguno se dejó poner
  const f = document.createElement('iframe')
  f.allow = 'autoplay; encrypted-media'
  // Un pedazo de CANVAS_LEN s desde CANVAS_AT, sin subtítulos (cc_load_policy=0)
  f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3` +
    `&modestbranding=1&playsinline=1&rel=0&cc_load_policy=0&start=${CANVAS_AT}&end=${CANVAS_AT + CANVAS_LEN + 2}&enablejsapi=1`
  f.onload = () => f.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
  canvasState.frame = f
  canvasBox.appendChild(f)
}
async function updateCanvas() {
  const song = currentSong
  if (!canvasOn || rightMode !== 'np' || !song || !navigator.onLine) {
    canvasState.song = null; canvasState.ids = []; canvasClear(); return
  }
  if (canvasState.song === song) return
  canvasState.song = song
  canvasState.ids = []
  canvasClear()
  const ids = await api.ytVideos(splitArtists(song.artist)[0] || song.artist || '', cleanTitle(song.title), /en vivo|live/i.test(song.title))
  if (canvasState.song !== song || !ids?.length) return
  canvasState.ids = ids
  canvasState.i = 0
  canvasBtn()
  if (!canvasState.userOff) canvasTry()
}
window.addEventListener('message', e => {
  if (!canvasState.frame || e.source !== canvasState.frame.contentWindow) return
  let m
  try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
  if (m.event === 'onError') { canvasState.i++; canvasTry(); return }   // no se deja incrustar: el siguiente
  if (m.event === 'onReady' || m.event === 'initialDelivery') {
    canvasCmd('unloadModule', ['captions'])   // sin subtítulos aunque el video los traiga
    canvasCmd('unloadModule', ['cc'])
  }
  // Antes de llegar al final se regresa al inicio del pedazo (al terminar, YouTube enseña
  // sugerencias y botones)
  const t = m.info?.currentTime
  if (typeof t === 'number' && t >= CANVAS_AT + CANVAS_LEN) canvasCmd('seekTo', [CANVAS_AT, true])
  const st = m.event === 'onStateChange' ? m.info : m.info?.playerState
  if (st === 0) { canvasCmd('seekTo', [CANVAS_AT, true]); canvasCmd('playVideo') }
  if (st === 1) {
    if (!canvasBox.classList.contains('on')) canvasShow()
  }
})
window.addEventListener('offline', () => { canvasState.song = null; canvasClear() })
window.addEventListener('online', updateCanvas)

function setCover(src) {
  for (const id of ['bar-cover', 'np-cover']) {
    const el = $(id)
    if (src) putImg(el, src)
    else { el.classList.add('ph'); el.innerHTML = svg(I.note) }
  }
  const lyr = $('view-lyrics')
  if (src) coverColor(src).then(c => {
    if (currentSong?.cover !== src) return
    lyr.style.backgroundColor = tone(c, 0.36)
    $('np-lyrics').style.backgroundColor = tone(c, 0.3)   // la tarjeta de la letra, del color de la portada
  })
  else lyr.style.backgroundColor = $('np-lyrics').style.backgroundColor = ''
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
  on: false, ai: false, vibe: null, recent: [], played: new Set(), next: null, prep: null, alt: null, altPrep: null, sinceHello: 0,
  quietUntil: 0, prepWip: null, voiceWaiting: false,   // hasta cuándo no se graba nada en segundo plano (le acabas de escribir)
  sameVibe: 0, used: new Set(),   // bloques seguidos en la misma vibra / canciones ya puestas en la sesión
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
// avoid: vibras que no se excluyen pero pesan mucho menos (p. ej. con la que arrancó la vez pasada)
// uniform: todos los géneros con la misma probabilidad (para arrancar el DJ)
function pickVibe(exclude = [], avoid = [], uniform = false) {
  const gg = getGenreGroups()
  // Tus gustos pesan poco (logaritmo a la mitad): si no, el género que más escuchas (cumbia)
  // salía en casi cada cambio de vibra
  const score = songs => { let a = 0; for (const s of songs) a += affinity(s); return 1 + 0.5 * Math.log1p(a) }
  // Se excluye por género: "merengue+m-bailar" también excluye "merengue" (si no, "cambiar
  // de vibra" podía pasar de merengue a merengue)
  const excludeGenres = exclude.map(k => k.split('+')[0])
  const genres = gg.genres.filter(g => g.songs.length >= 8 && !excludeGenres.includes(g.key))
  if (!genres.length) return null
  const genre = uniform ? genres[Math.floor(Math.random() * genres.length)] : weightedPick(genres, g => score(g.songs) * timeBoost(g.key) *
    (dj.played.has(g.key) ? 0.05 : 1) * (avoid.includes(g.key) ? 0.2 : 1))
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

// Género principal de una canción (el de más puntaje): una cumbia que también trae "vallenato"
// es cumbia, no vallenato
const mainGenre = s => (s.genres || []).find(id => !GENRE_BY_ID.get(id)?.mood)

// 5–6 canciones: lo que más te late de ese pool, alguna olvidada, máximo 2 por artista.
// genre: si la vibra es un género, las que son de otro género principal pesan poco, máximo
// 1 por bloque y nunca abren (si no, la cumbia que más escuchas abría casi cualquier vibra)
const keyPart = t => fold(t).replace(/[^a-z0-9ñ]/g, '')
const songKey = s => s._key || (s._key = keyPart(cleanTitle(s.title)) + '|' + keyPart(splitArtists(s.artist)[0] || ''))

// Lo que el DJ ya puso y cuándo (canción → fecha): lo de los últimos días casi no se repite
let djSeen = load('djSeen', {})
function markDjSeen(songs) {
  const now = Date.now(), limit = now - 14 * 864e5
  for (const s of songs) djSeen[songKey(s)] = now
  for (const p in djSeen) if (djSeen[p] < limit) delete djSeen[p]
  save('djSeen', djSeen)
}
function seenFactor(s) {
  const age = Date.now() - (djSeen[songKey(s)] || 0)
  return age < 3 * 864e5 ? 0.06 : age < 7 * 864e5 ? 0.35 : 1
}

function buildBlock(pool, n = 5, genre = null) {
  const t = Date.now() - 3 * 36e5
  const keyOf = p => { const x = songByPath.get(p); return x ? songKey(x) : p }
  const recent = new Set(playLog.filter(([, ts]) => ts > t).map(([p]) => keyOf(p)))
  const now = currentSong && songKey(currentSong)
  // Una sola copia de cada canción (la que más escuchas)
  const byKey = new Map()
  for (const x of pool) { const k = songKey(x), o = byKey.get(k); if (!o || affinity(x) > affinity(o)) byKey.set(k, x) }
  const uniq = [...byKey.values()]
  let cands = uniq.filter(x => songKey(x) !== now && !recent.has(songKey(x)))
  if (cands.length < n) cands = uniq.filter(x => songKey(x) !== now)
  const heard = new Set(Object.keys(plays).map(keyOf))
  const pure = s => !genre || mainGenre(s) === genre
  const enoughPure = cands.filter(pure).length >= n
  let mixed = 0
  const out = [], perArtist = new Map()
  // Si el pool es de pocos artistas (p. ej. "pon a Kevin Kaarl") se permiten más por artista
  const artists = new Set(cands.map(s => splitArtists(s.artist)[0] || ''))
  const cap = Math.max(2, Math.ceil(n / artists.size))
  // 1–2 por bloque que nunca has escuchado (o casi), para descubrir lo que tienes guardado
  const fresh = cands.filter(x => !heard.has(songKey(x)) && pure(x) && seenFactor(x) === 1)
  let wantFresh = Math.min(fresh.length, n >= 5 ? 2 : 1)
  while (out.length < n && cands.length) {
    const pickFresh = wantFresh > 0
    const from = pickFresh ? cands.filter(x => fresh.includes(x)) : cands
    if (!from.length) { wantFresh = 0; continue }
    // Tus gustos pesan menos que antes (con 2× salían siempre las mismas favoritas)
    const s = pickFresh ? from[Math.floor(Math.random() * from.length)]
      : weightedPick(from, x => (1 + Math.log1p(affinity(x)) + (likedPaths.has(x.path) ? 0.5 : 0) + (forgotten(x) ? 2 : 0)) *
        (pure(x) ? 1 : 0.25) * seenFactor(x))
    if (pickFresh) wantFresh--
    cands = cands.filter(x => x !== s)
    const a = splitArtists(s.artist)[0] || ''
    if ((perArtist.get(a) || 0) >= cap) continue
    if (!pure(s) && enoughPure && mixed++ >= 1) continue
    perArtist.set(a, (perArtist.get(a) || 0) + 1)
    out.push(s)
  }
  // Arranca con una conocida que sea de verdad de ese género
  out.sort((a, b) => (pure(b) - pure(a)) || affinity(b) - affinity(a))
  return out
}

// Vibra para arrancar: un género al azar (todos igual de probables, no importa cuánto lo
// escuches), sin repetir los de los últimos 3 arranques
function startVibe() {
  const starts = load('djStarts', [])
  return pickVibe(starts, [], true) || pickVibe([], [], true)
}

// Lo más escuchado de la semana (y de hoy), para que Nat lo comente de vez en cuando.
// Los minutos son aproximados: duración de la canción × veces que la escuchaste
function weekStats() {
  const now = Date.now(), t = now - 7 * 864e5, today = new Date().setHours(0, 0, 0, 0)
  const byArtist = new Map(), artistMin = new Map(), bySong = new Map(), songToday = new Map(), byGenre = new Map()
  let minutes = 0
  const inc = (m, k, v = 1) => m.set(k, (m.get(k) || 0) + v)
  for (const [p, ts] of playLog) {
    if (ts < t) continue
    const s = songByPath.get(p)
    if (!s) continue
    const min = (s.duration || 180) / 60
    minutes += min
    const a = splitArtists(s.artist)[0]
    if (a) { inc(byArtist, a); inc(artistMin, a, min) }
    inc(bySong, s)
    if (ts >= today) inc(songToday, s)
    const g = mainGenre(s)
    if (g) inc(byGenre, g)
  }
  const top = m => [...m].sort((x, y) => y[1] - x[1])[0]
  const artist = top(byArtist)
  return { artist, artistMin: artist && Math.round(artistMin.get(artist[0])), song: top(bySong),
           songToday: top(songToday), genre: top(byGenre), minutes: Math.round(minutes) }
}

// Un dato al azar de lo que has escuchado; no repite el último que dijo
function personalFact() {
  const { artist, artistMin, song, songToday, genre, minutes } = weekStats()
  const name = s => `${cleanTitle(s.title)} de ${splitArtists(s.artist)[0]}`
  const facts = []
  if (artist?.[1] >= 3) facts.push(`esta semana escuchó ${artist[1]} veces a ${artist[0]}`)
  if (artistMin >= 15) facts.push(`esta semana lleva como ${artistMin} minutos escuchando a ${artist[0]}`)
  if (song?.[1] >= 3) facts.push(`la rola que más ha repetido esta semana es ${name(song[0])} (${song[1]} veces)`)
  if (songToday?.[1] >= 3) facts.push(`hoy ya repitió ${songToday[1]} veces ${name(songToday[0])}`)
  if (minutes >= 60) facts.push(`esta semana lleva como ${minutes >= 120 ? Math.round(minutes / 60) + ' horas' : minutes + ' minutos'} de música`)
  if (genre?.[1] >= 5) facts.push(`el género que más escuchó esta semana es ${GENRE_BY_ID.get(genre[0]).name}`)
  const last = load('djLastFact', '')
  const pool = facts.filter(f => f.replace(/\d+/g, '') !== last)
  const pick = (pool.length ? pool : facts)[Math.floor(Math.random() * (pool.length || facts.length))]
  if (pick) save('djLastFact', pick.replace(/\d+/g, ''))
  return pick || null
}

function weatherText() {
  const k = { lluvia: 'está lloviendo', calor: 'hace mucho calor', frio: 'hace frío' }[weather.kind] || 'clima normal'
  return `${k} en ${weather.city || 'su ciudad'}, ${weather.temp} °C`
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
    continua_lo_que_escuchaba: block.vibe.fromRecent || undefined,
    cancion_que_no_escuchas_hace_mucho: old && old !== first ? `${cleanTitle(old.title)} de ${splitArtists(old.artist)[0]}` : null,
  }
}

const DJ_SYSTEM =
  'Eres la voz que presenta la música en el reproductor personal del usuario, como una locutora de radio mexicana ' +
  'joven: cálida, carismática y con jerga mexicana natural, sin exagerar. ' +
  'Tu personalidad: divertida y un poco chismosa, le echas carrilla al usuario con cariño, tienes opiniones ' +
  'de la música (te emocionas con las rolas que te laten), haces referencias a la vida diaria en México ' +
  '(el tráfico, los tacos, la quincena, el calor, la desvelada), te ríes de ti misma y a veces eres coqueta ' +
  'pero respetuosa. Suenas a amiga, no a anuncio. ' +
  'Te llamas DJ Nat. Reglas: de 1 a 3 frases y máximo 32 palabras; platica como en la radio, no sólo anuncies la rola. Se escribe "rola" (con una sola ele). ' +
  'NO te presentes ni digas tu nombre (nada de "soy DJ Nat", "aquí tu…") salvo que la tarea lo pida. NO saludes ni digas la hora o el día, salvo que la tarea lo pida. Ve directo a la música. ' +
  'Usa sólo los datos que te dan; no inventes canciones, artistas ni datos. Sin emojis, comillas, asteriscos, ' +
  'listas ni acotaciones entre paréntesis. Háblale de tú. Varía tus frases: no empieces siempre igual. ' +
  'Si hablas de la hora del día (mañana, tarde, noche, madrugada), usa la de momento_del_dia; nunca otra.'

const DJ_TASK = {
  welcome: 'El usuario acaba de abrir la app. Salúdalo con el saludo y su nombre (si lo hay), preséntate ("soy DJ Nat"), si viene el clima coméntalo en pocas palabras, dile la hora ' +
           'tal cual viene en los datos (con números, ej. "son las 11:30 p. m."), y dile que empiezan con una playlist que ' +
           'le hiciste, mencionando la vibra y la primera rola. Si viene un dato personal, coméntalo de forma natural y ' +
           'con sus números (ej. "esta semana llevas 95 minutos con Bad Bunny"). Si es de madrugada, puedes comentarlo. Máximo 40 palabras.',
  welcome2: 'Ya lo saludaste hace un segundo: NO vuelvas a saludar ni a presentarte. Dile la hora tal cual viene en los ' +
            'datos (con números, ej. "son las 11:30 p. m.") y que empiezan con una playlist que le hiciste, mencionando la ' +
            'vibra y la primera rola. Si viene un dato personal, coméntalo de forma natural y con sus números ' +
            '(ej. "hoy ya repetiste 5 veces Gil"). Máximo 35 palabras.',
  intro:   'Es la primera canción de la sesión: un saludo muy corto (dos o tres palabras) y presenta el bloque.',
  next:    'Haz la transición al siguiente bloque como en la radio, sin saludar.',
  continue: 'Siguen con la misma vibra de antes: haz la transición dando a entender que continúan con ese mood o ' +
            'estilo, con tus propias palabras, sin saludar.',
  drift:   'Siguen con rolas parecidas a lo que venía sonando: haz la transición conectando con el estilo anterior, sin saludar.',
  switch:  'El usuario pidió cambiar de vibra. Confírmalo con buena onda y presenta el nuevo bloque, sin saludar.',
}

// Para que no diga siempre lo mismo: cada frase lleva un estilo distinto, un par de
// expresiones sugeridas al azar y las últimas frases que dijo (para no repetirlas)
const DJ_ANGLES = [
  'Échale porras al artista de la primera rola, como fan.',
  'Hazle una pregunta juguetona al usuario sobre la rola o su mood.',
  'Dilo con mucha energía, como si fuera el mejor momento de la noche en la radio.',
  'Dilo tranqui y cercana, como si platicaran en confianza.',
  'Haz una comparación chistosa o una exageración ligera sobre la vibra.',
  'Invítalo a hacer algo con la rola: cantarla, bailarla, subirle, cerrar los ojos…',
  'Conecta la vibra con un momento cotidiano (la chamba, el tráfico, la desvelada, la fiesta, el desamor).',
  'Haz un mini comentario de complicidad, como si ya conocieras sus gustos.',
  'Empieza directo con el nombre de la rola o del artista y luego un comentario.',
  'Usa un tono de locutora que anuncia algo especial: "atención", "ojo", "aguas"…',
  'Hazlo cortito y con punch: una sola frase.',
  'Ponle un toque de humor con un dicho o refrán mexicano: DICHO.',
  'Cuéntalo como chisme: "te tengo una"…',
  'Dilo como si la rola fuera un regalo que le tenías guardado.',
  'Haz como que la rola te encanta a ti también y por qué.',
  'Describe en pocas palabras cómo se siente la rola (el ritmo, la voz, la letra).',
  'Dale un consejo cortito relacionado con el mood (pa la tusa, pa la fiesta, pa relajarse).',
  'Hazlo con picardía y coqueteo ligero de locutora.',
  'Dilo como si estuvieras en vivo con mucha gente escuchando.',
  'Haz una predicción juguetona: "esta va a ser tu nueva favorita", "esta la vas a repetir"…',
  'Haz que suene a complicidad de desvelo o de fiesta según la hora.',
  'Menciona sólo al artista y deja que la rola hable, súper breve.',
  'Haz un brindis por la vibra o por el usuario.',
  'Dilo con dramatismo de telenovela, de forma chistosa.',
  'Relaciónalo con un plan: la peda, el gym, limpiar el cuarto, manejar, estudiar.',
  'Hazlo como reto: a ver si no la canta, a ver si aguanta sin bailar.',
]
// Cómo empezar la frase (lo que más se repetía era el inicio)
const DJ_OPENERS = ['con una exclamación', 'con una pregunta', 'con el nombre de la rola', 'con el nombre del artista',
  'hablando de la vibra', 'con una expresión mexicana', 'con un comentario sobre el momento del día', 'con algo chistoso',
  'con "oye"', 'con "atención"', 'con un "uff" o "uy"', 'directo con lo que sigue']
const DJ_SLANG = ['qué chido', 'está cañón', 'aguas', 'sale y vale', 'no manches', 'qué rico', 'está perrón',
  'neta', 'a darle', 'ándale', 'pura vida', 'bien bonito', 'de lujo', 'que no pare', 'súbele', 'qué tal eh',
  'a lo que vinimos', 'ni modo', 'chulada', 'qué belleza', 'ahí te va', 'pa que te acuerdes', 'agárrate',
  'esto pega', 'bien sabrosón', 'para el alma', 'sin miedo', 'arre', 'échale', 'pura calidad',
  'qué joyita', 'me encanta', 'puro sentimiento', 'pa llorar bonito', 'con todo el power', 'ufff', 'qué temazo',
  'esta sí', 'te va a gustar', 'pa los compas', 'ni cómo ayudarte', 'de las buenas', 'sin pena', 'bien recio',
  'a todo volumen', 'pa la banda', 'está de poca', 'qué onda con esta', 'joya', 'qué viaje', 'bien prendido',
  'pa que se te quite lo aguado', 'como debe ser', 'directo al corazón', 'qué rolón']
const DJ_DICHOS = ['al mal tiempo, buena cara', 'el que es perico donde quiera es verde', 'no hay mal que por bien no venga',
  'más vale tarde que nunca', 'a darle que es mole de olla', 'de lengua me como un taco', 'el que madruga, Dios lo ayuda',
  'echando a perder se aprende', 'hierba mala nunca muere', 'ojos que no ven, corazón que no siente',
  'a falta de pan, tortillas', 'más vale paso que dure y no trote que canse', 'el que no arriesga no gana',
  'genio y figura hasta la sepultura', 'como anillo al dedo', 'no hay quinto malo', 'cada quien su mole',
  'agua que no has de beber, déjala correr', 'el amor y el interés se fueron al campo un día', 'eso es harina de otro costal',
  'quien canta su mal espanta', 'más vale maña que fuerza', 'del plato a la boca se cae la sopa',
  'a buen entendedor, pocas palabras', 'donde comen dos comen tres', 'no por mucho madrugar amanece más temprano',
  'el que es buen gallo donde quiera canta', 'a otro perro con ese hueso', 'ni tanto que queme al santo ni tanto que no lo alumbre',
  'después de la tormenta viene la calma']
const DJ_BANNED = 'camarón que se duerme (ni ningún otro dicho que no te den), ¿a poco no se antoja?, ¿a poco no?, ¿a poco no está buenísima?, se antoja, bien a gusto, ' +
  'la neta se va a poner buena, la neta te va a encantar, va que va, arrancamos con, cambiamos de vibra, ' +
  'esta rola de X llamada Y, de hace rato, empezar con "Va", empezar con el nombre del usuario'
let djLines = load('djLines', [])
let djAngleLog = []
function djVariety() {
  const free = DJ_ANGLES.filter(a => !djAngleLog.includes(a))
  const angle = free[Math.floor(Math.random() * free.length)]
    .replace('DICHO', '"' + DJ_DICHOS[Math.floor(Math.random() * DJ_DICHOS.length)] + '"')
  djAngleLog = [angle.replace(/: ".*"\.$/, ': DICHO.'), ...djAngleLog].slice(0, 5)
  const slang = [...DJ_SLANG].sort(() => Math.random() - 0.5).slice(0, 2)
  const opener = DJ_OPENERS[Math.floor(Math.random() * DJ_OPENERS.length)]
  return `\nEstilo de esta vez: ${angle} Empieza ${opener}. Si te late, usa alguna de estas expresiones: ${slang.join(', ')}. ` +
    `Prohibido usar: ${DJ_BANNED}.` +
    (djLines.length ? `\nFrases que ya dijiste (NO repitas sus inicios, cierres ni muletillas; que suene distinta): ${djLines.slice(0, 8).join(' | ')}` : '')
}
function rememberLine(line) {
  djLines = [line, ...djLines].slice(0, 12)
  save('djLines', djLines)
}

const DJ_TEMPLATES = {
  welcome2: ['Son las {hora}. Empecemos con una playlist que te hice: {vibra}, y abre {artista}.'],
  welcome: [
    '{saludo}{nombre}. Soy DJ Nat y son las {hora}. Empecemos con una playlist que te hice: {vibra}, y abre {artista}.',
  ],
  intro: [
    '¡Qué onda! Hoy el ambiente huele a {vibra}, y abre {artista}.',
    'Hoy toca {vibra}. Para empezar, {cancion} de {artista}.',
    '¡Atención! {artista} abre esta selección de {vibra}.',
    'Ya estamos al aire con {vibra}. Primero, {cancion}.',
  ],
  next: [
    'Ahora le toca a {vibra}. Abre {artista}, súbele.',
    'Lo que sigue es {vibra}, y {artista} viene con {cancion}.',
    'Ahí te va un bloque de {vibra}. {artista} pone el ambiente.',
    '¿Listo? Ahora va {vibra} con {cancion} de {artista}.',
    'Oye, esto pega: {cancion} de {artista}, puro {vibra}.',
    'Uff, viene {artista} con {cancion}. Que no pare el {vibra}.',
  ],
  switch: [
    '¡Sale! Otro rollo: {vibra}. Va {artista}.',
    'Cambio de aires: {vibra}, con {cancion} de {artista}.',
    'Lo que pidas. Ahora suena {vibra}, empezando por {artista}.',
    '¡Uy, buena elección! {vibra} con {cancion}.',
  ],
}

function templateLine(kind, f) {
  const list = DJ_TEMPLATES[kind] || DJ_TEMPLATES.next
  return list[Math.floor(Math.random() * list.length)]
    .replace('{vibra}', f.vibra.toLowerCase()).replace('{artista}', f.primer_artista)
    .replace('{cancion}', f.primera_cancion).replace('{dia}', f.dia)
    .replace('{saludo}', f.saludo || '¡Hola').replace('{nombre}', f.nombre ? `, ${f.nombre}` : '').replace('{hora}', f.hora || '')
}

// Lo que escribe la IA antes de pasarlo a voz: sin acotaciones entre paréntesis (la voz las
// leería), comillas ni asteriscos, "rola" bien escrito
function cleanLine(t) {
  return String(t).replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
    // La muletilla que ya cansaba, por si se le escapa
    .replace(/\s*¿?\s*a poco no se (te )?antoja\s*\??/gi, '').replace(/\s{2,}/g, ' ').replace(/[*"“”]/g, '').replace(/\brollas?\b/gi, m => m.replace(/ll/i, 'l')).trim()
}

const clockText = t => new Date(t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })

// urgent: alguien está esperando (no se prepara con calma): si Google tarda, frase armada
async function djLine(kind, block, { noTime = false, urgent = false } = {}) {
  const f = blockFacts(block)
  const ph = partOfDay(new Date(Date.now() + (block.ahead || 0)).getHours())
  f.momento_del_dia = ph === 'manana' ? 'mañana' : ph
  if (kind === 'welcome' || kind === 'welcome2') {
    // Sólo en la bienvenida: saludo según la hora, nombre y hora exacta
    const d = new Date(), h = d.getHours()
    // De 12 a 6 am no es "buenas noches": es madrugada
    f.saludo = h < 6 ? 'Qué onda' : h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
    f.momento = partOfDay(h) === 'manana' ? 'mañana' : partOfDay(h)
    f.nombre = userName || undefined
    f.hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
    f.dia = DAYS[d.getDay()]
    if (weather?.kind) f.clima = weatherText()   // sólo si llueve, hace calor o frío
    const fact = Math.random() < 0.5 && personalFact()
    if (fact) f.dato_personal = fact
    block.timed = Date.now()
  }
  // Cada 3 bloques (contando desde el saludo) dice tu nombre y la hora, como en la radio
  let task = DJ_TASK[kind] || DJ_TASK.next
  const transition = ['next', 'switch', 'continue', 'drift'].includes(kind)
  if (transition && dj.sinceHello >= 2 && !noTime) {
    f.nombre = userName || undefined
    // ahead: se prepara unos segundos antes de que acabe la canción; la hora es la de cuando hable
    f.hora = block.hora = clockText(Date.now() + (block.ahead || 0))
    const where = ['a la mitad de la frase', 'al final', 'al principio pero sin empezar con su nombre', 'como comentario al pasar'][Math.floor(Math.random() * 4)]
    task += ` Esta vez dile su nombre (si lo hay) y la hora tal cual viene en los datos (con números), ${where}.`
    block.timed = Date.now()
  } else if (transition) {
    // De vez en cuando, algo personal o el día, para que no suene siempre igual
    // Su nombre también entre bloques (no sólo cuando toca la hora)
    if (userName && Math.random() < 0.45) {
      f.nombre = userName
      task += ' Dile su nombre de forma natural.'
    }
    const roll = Math.random(), fact = roll < 0.3 && personalFact()
    if (fact) {
      f.dato_personal = fact
      task += ' Menciona el dato personal con tus propias palabras.'
    } else if (roll >= 0.3 && roll < 0.5) {
      f.dia = DAYS[new Date().getDay()]
      task += ' Menciona el día con tus propias palabras.'
    } else if (roll >= 0.5 && roll < 0.65 && weather?.kind) {
      f.clima = weatherText()
      task += ' Comenta el clima con tus propias palabras.'
    }
  }
  if (dj.ai) {
    const r = await api.djThink(DJ_SYSTEM, `${task}\nDatos: ${JSON.stringify(f)}${djVariety()}`, undefined, urgent)
    if (r.ok) { const line = cleanLine(r.ok); rememberLine(line); return line }
  }
  return templateLine(kind, f)
}

// Texto → archivo de voz para frases que se preparan con calma (el siguiente bloque):
// Laomedeia (Gemini) generada completa y verificada; si no sale bien, Dalia (Edge, sin
// límite). Sin internet, la voz de Windows. Cuando alguien espera se usa speakLive().
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
// onNearEnd: se llama cuando a la voz le falta ~1.5 s (ahí entra la música nueva)
function speak(text, file, onNearEnd, { keepDuck = false } = {}) {
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
      if (!keepDuck) duck(false)
      renderDjPanel()
      resolve()
    }
    const guard = setTimeout(finish, 45000)
    dj.speaking = true
    duck(true)
    if (audioCtx.state === 'suspended') audioCtx.resume()
    djSay(text)   // el texto aparece cuando empieza a hablar, no antes
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

// ── Voz en vivo: los pedazos de PCM (16 bits, 24 kHz) se encolan en Web Audio en cuanto
// llegan, así Nat empieza a hablar ~2 s después en lugar de esperar todo el audio.
const voiceOut = audioCtx.createGain()   // la voz no pasa por el volumen/analizador de la música
voiceOut.connect(audioCtx.destination)
const voiceAnalyser = audioCtx.createAnalyser()
voiceAnalyser.fftSize = 1024
voiceOut.connect(voiceAnalyser)
audioCtx.createMediaElementSource(djAudio).connect(voiceOut)
const voiceStreams = new Map()
let streamSeq = 0
let activeStream = null
api.onDjChunk((id, b64) => voiceStreams.get(id)?.(b64))

function streamVoice(id, { onFirst, onNearEnd, after }) {
  let next = 0, playing = 0, ended = false, near = false, resolveDone
  let gateOpen = !after
  const sources = [], pending = []
  const done = new Promise(r => { resolveDone = r })
  const check = () => {
    if (!gateOpen) return
    if (ended && !near && next - audioCtx.currentTime <= 1.5) { near = true; onNearEnd?.() }
    if (ended && playing === 0) resolveDone()
  }
  const timer = setInterval(check, 100)
  const schedule = b64 => {
    const bin = atob(b64), n = bin.length >> 1
    if (!n) return
    const buf = audioCtx.createBuffer(1, n, 24000), ch = buf.getChannelData(0)
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)
      if (v >= 32768) v -= 65536
      ch[i] = v / 32768
    }
    if (!next) { if (audioCtx.state === 'suspended') audioCtx.resume(); onFirst?.() }
    const src = audioCtx.createBufferSource()
    src.buffer = buf
    src.connect(voiceOut)
    // Colchón de 0.3 s al inicio por si algún pedazo llega tarde
    const t = Math.max(next, audioCtx.currentTime + (next ? 0.02 : 0.3))
    src.start(t)
    next = t + buf.duration
    playing++
    sources.push(src)
    src.onended = () => { playing--; check() }
  }
  // after: lo que está sonando antes (el saludo grabado); mientras, los pedazos se guardan
  if (after) after.then(() => { gateOpen = true; for (const b of pending.splice(0)) schedule(b); check() })
  const feed = b64 => { dj.voiceWaiting = true; gateOpen ? schedule(b64) : pending.push(b64) }
  if (id != null) voiceStreams.set(id, feed)
  const stop = () => { clearInterval(timer); if (id != null) voiceStreams.delete(id) }
  return {
    feed,
    started: () => next > 0 || pending.length > 0,
    end: () => { ended = true; check(); return done.finally(stop) },
    cancel: () => { pending.length = 0; for (const s of sources) try { s.stop() } catch {} ; stop(); resolveDone() },
  }
}

// Dice `text` al instante con la voz de Nat (en vivo). Dalia se genera en paralelo: si Google
// no manda audio, entra ella sin otra espera. Sin Gemini, directo a la voz de respaldo.
async function speakLive(text, onNearEnd, after) {
  if (!dj.ai) { const file = await djVoice(text); await after; return speak(text, file, onNearEnd) }
  const dalia = api.djSay(text, 'dalia')
  let near = false
  const nearEnd = () => { if (!near) { near = true; onNearEnd?.() } }
  const player = streamVoice(null, {
    onFirst: () => { dj.thinking = false; dj.speaking = true; duck(true); djSay(text) },
    onNearEnd: nearEnd,
    after,
  })
  activeStream = player
  const t0 = Date.now()
  // Google a veces manda el texto pero no el audio: se intenta otra vez (con dos intentos a la
  // vez) hasta ~12 s; si no, Dalia (o la voz del celular), que ya está lista
  let r
  do r = await raceVoice(text, player)
  while (activeStream === player && !player.started() && r.error && !r.partial &&
         r.error !== 'invalid-key' && Date.now() - t0 < 12000)
  if (activeStream !== player) return   // se detuvo el DJ mientras hablaba
  activeStream = null
  if (player.started()) {
    await player.end()
    nearEnd()
    dj.speaking = false
    duck(false)
    renderDjPanel()
    return
  }
  player.cancel()
  // No sonó nada: estaba en caché (archivo) o Google no mandó audio (Dalia ya está lista)
  const file = r.ok?.file || (await dalia).ok || null
  await after
  dj.thinking = false
  return speak(text, file, onNearEnd)
}

// Dos intentos de voz a la vez: si en 2 s el primero no manda audio (o falla antes), sale otro, y
// el primero que mande audio es el que suena (el otro se cancela). Igual que con el texto.
function raceVoice(text, player) {
  return new Promise(resolve => {
    const ids = []
    let winner = null, pending = 0, hedged = false, last = null
    const launch = () => {
      const id = ++streamSeq
      ids.push(id)
      pending++
      voiceStreams.set(id, b64 => {
        if (winner == null) { winner = id; for (const o of ids) if (o !== id) api.djCancel?.(o) }
        if (winner === id) player.feed(b64)
      })
      api.djSayNow(text, id).then(r => {
        voiceStreams.delete(id)
        pending--
        if (winner === id || r.ok?.file || r.error === 'invalid-key') { clearTimeout(t); resolve(r); return }
        if (winner != null) return   // perdió la carrera: se espera al que sí está sonando
        last = r
        if (!hedged && activeStream === player) { hedged = true; clearTimeout(t); launch() }
        else if (!pending) { clearTimeout(t); resolve(last) }
      })
    }
    launch()
    const t = setTimeout(() => {
      if (winner == null && !hedged && activeStream === player) { hedged = true; launch() }
    }, 2000)
  })
}

function djSay(text) { dj.log.push({ who: 'dj', text }); dj.log = dj.log.slice(-30); api.djChatLog('Nat', text); renderDjPanel() }

// Pone un bloque como en la radio: primero habla Nat (lo que ya sonaba sigue mientras
// prepara qué decir) y cuando está por terminar entra la primera canción desde abajo.
// after: algo que está sonando antes (el saludo grabado); la frase entra al terminar
async function djPlay(block, prepared, after) {
  dj.on = true
  dj.sameVibe = dj.vibe?.key === block.vibe.key ? dj.sameVibe + 1 : 0
  for (const s of block.songs) dj.used.add(songKey(s))
  markDjSeen(block.songs)
  dj.vibe = block.vibe
  dj.recent = [block.vibe.key, ...dj.recent.filter(k => k !== block.vibe.key)].slice(0, 3)
  // Géneros que ya sonaron en la sesión (dj.recent guarda "cumbia+m-bailar", que nunca
  // coincidía con "cumbia", y por eso la cumbia regresaba seguido)
  if (!block.vibe.key.startsWith('sim:')) dj.played.add(block.vibe.key.split('+')[0])
  dj.sinceHello = block.timed ? 0 : dj.sinceHello + 1
  dj.next = null
  dj.prepWip = null
  const ready = prepared && 'file' in prepared
  dj.thinking = !ready
  renderDjPanel()
  const line = prepared?.line ?? await djLine(block.kind, block, { urgent: true })
  if (block.timed) dj.sinceHello = 0
  if (!dj.on) { dj.thinking = false; renderDjPanel(); return }
  let started = false
  const startMusic = () => {
    if (started || !dj.on) return
    started = true
    playList(block.songs, 0, DJ_CTX)   // entra bajita (la voz la tiene agachada) y sube al terminar
  }
  // Preparada (siguiente bloque): suena de inmediato. Si no, en vivo.
  if (ready) { await after; dj.thinking = false; await speak(line, prepared.file, startMusic) }
  else await speakLive(line, startMusic, after)
  startMusic()
  setTimeout(() => { if (dj.on && playContext === DJ_CTX) djPrepare(blockLeftMs()) }, 40000)
  prepareAlt()
}

function startBlock(kind) {
  const vibe = startVibe()
  return vibe && { kind, vibe, songs: buildBlock(vibe.songs, 5, vibe.key.split('+')[0]) }
}

// Siguiente bloque: sigue con la misma vibra (hasta 2 bloques o hasta que se acaben sus
// canciones) y luego pasa a rolas que suenan parecido a la última. Cambiar de género es
// cosa de "Cambiar vibra".
async function continueBlock() {
  const v = dj.vibe
  if (v?.songs && dj.sameVibe < 1) {
    const pool = v.songs.filter(s => !dj.used.has(songKey(s)))
    if (pool.length >= 5) return { kind: 'continue', vibe: v, songs: buildBlock(pool, 5, v.key.split('+')[0]) }
  }
  const seed = currentSong
  if (seed) {
    const sim = (await similarSongs(seed)).filter(s => !dj.used.has(songKey(s)))
    if (sim.length >= 5) {
      const g = (seed.genres || []).map(id => GENRE_BY_ID.get(id)).find(x => x && !x.mood)
      const vibe = { key: 'sim:' + seed.path, name: g ? `${g.name} y parecidas` : 'Rolas parecidas', songs: sim }
      return { kind: 'drift', vibe, songs: buildBlock(sim) }
    }
  }
  return newBlock('next', v ? [v.key] : [])
}

function newBlock(kind, exclude = []) {
  const vibe = pickVibe(exclude)
  return vibe && { kind, vibe, songs: buildBlock(vibe.songs, 5, vibe.key.split('+')[0]) }
}

let userName    = load('userName', '')

// La primera vez que lo inicias en cada sesión te saluda (hora, tu nombre); luego ya no
let welcomed = false
async function djStart() {
  if (!allSongs.length) return
  dj.recent = []
  dj.played = new Set()
  dj.used = new Set()
  const kind = welcomed ? 'intro' : 'welcome'
  welcomed = true
  const ready = kind === 'welcome' && welcomeReady && Date.now() - welcomeReady.at < 2 * 60 * 1000 ? welcomeReady : null
  welcomeReady = null
  // Si el saludo completo no alcanzó a grabarse, suena al instante uno de los guardados y lo
  // demás (la hora y la playlist) se prepara en vivo mientras lo dice
  const greet = kind === 'welcome' && !ready ? await cachedGreeting() : null
  const block = ready?.block || startBlock(greet ? 'welcome2' : kind)
  if (!block) { djSay('Todavía estoy conociendo tu música. Dame un ratito a que termine de clasificarla.'); return }
  const g0 = block.vibe.key.split('+')[0]
  save('djStarts', [g0, ...load('djStarts', []).filter(k => k !== g0)].slice(0, 3))
  if (rightMode !== 'dj') setRight('dj')
  const after = greet ? speak(greet.text, greet.file) : undefined
  await djPlay(block, ready && { line: ready.line, file: ready.file }, after)
}

// ── Saludos ya grabados ───────────────────────────────────────────────────────
// Se graban con calma (y revisados) mientras usas la app y se guardan para siempre, así al
// iniciar a DJ Nat siempre hay uno listo para sonar al instante, aunque acabes de abrir la app.
const GREETINGS = {
  madrugada: [
    '¡Qué onda, {n}! Aquí DJ Nat, desvelándome contigo.',
    '¡Ey, {n}! Soy DJ Nat, ¿otra vez de desvelo en plena madrugada?',
    '¡Hey, {n}! DJ Nat en la madrugada, aquí seguimos al pie del cañón.',
    '¡{n}! Aquí DJ Nat, pa la desvelada no hay nada como buena música.',
    '¡Qué onda, {n}! DJ Nat al habla, ya de madrugada y seguimos con todo.',
    '¡Qué onda, {n}! Aquí DJ Nat, los demás ya duermen pero nosotros no.',
    '¡Qué onda, {n}! DJ Nat aquí, ¿no puedes dormir? Yo te hago compañía.',
    '¡{n}, ya es tardísimo! Pero bueno, DJ Nat se queda contigo en el desvelo.',
  ],
  manana: [
    '¡Buenos días, {n}! Soy DJ Nat, ¿cómo amaneciste?',
    '¡Buen día, {n}! Aquí DJ Nat, lista pa arrancar contigo.',
    '¡Buenos días, {n}! DJ Nat reportándose, vamos a empezar con todo.',
    '¡Arriba, {n}! Aquí DJ Nat pa despertarte con buena música.',
    '¡Qué tal, {n}! DJ Nat por acá, ¿ya con tu cafecito?',
    '¡Buenos días, buenos días, {n}! DJ Nat con toda la energía.',
    '¡Ey, {n}! DJ Nat aquí, vamos a despertar al mundo con música.',
    '¡Mañanita bonita, {n}! Soy DJ Nat, empecemos tranquis.',
  ],
  tarde: [
    '¡Buenas tardes, {n}! Soy DJ Nat, qué gusto tenerte de vuelta.',
    '¡Qué onda, {n}! Aquí DJ Nat, ¿cómo va esa tarde?',
    '¡Buenas tardes, {n}! DJ Nat al habla, vamos a ponerle sabor al día.',
    '¡Hey, {n}! Aquí DJ Nat, ¿cómo te está tratando la tarde?',
    '¡{n}, qué gusto! Soy DJ Nat, ya te tenía unas rolas preparadas.',
    '¡Qué onda, {n}! DJ Nat aquí, la tarde está pa ponerle música.',
    '¡Ey, {n}! Aquí DJ Nat, hora de un break con buenas rolas.',
    '¡{n}! Soy DJ Nat, ¿cansancio de la tarde? Esto lo arregla.',
  ],
  noche: [
    '¡Buenas noches, {n}! Soy DJ Nat, qué bueno que llegaste.',
    '¡Qué onda, {n}! Aquí DJ Nat pa acompañarte esta noche.',
    '¡Buenas noches, {n}! DJ Nat en cabina, ¿cómo estuvo tu día?',
    '¡Hey, {n}! Aquí DJ Nat, la noche apenas empieza.',
    '¡{n}! Soy DJ Nat, ya te estaba esperando pa la noche.',
    '¡Uy, {n}! Aquí DJ Nat, la noche pinta bien.',
    '¡Qué onda, {n}! DJ Nat aquí, a relajarnos después de todo el día.',
    '¡Ey, {n}! Soy DJ Nat, llegó la hora buena de la noche.',
  ],
}
// Especiales según el día de la semana (0 = domingo … 6 = sábado), además de los de arriba
const GREETINGS_DAY = {
  0: { tarde: ['¡Buenas tardes, {n}! DJ Nat aquí, domingo tranquilo y con buena música.'],
       noche: ['¡Buenas noches, {n}! Soy DJ Nat, cerremos el domingo bien bonito.'] },
  1: { manana: ['¡Buenos días, {n}! DJ Nat aquí, ánimo que ya es lunes.',
                '¡Feliz lunes, {n}! Soy DJ Nat, vamos a empezar la semana con todo.'] },
  2: { manana: ['¡Buenos días, {n}! DJ Nat aquí, martes y con todo.'],
       noche: ['¡Qué onda, {n}! Soy DJ Nat, ya sobrevivimos al martes.'] },
  3: { manana: ['¡Ya es miércoles, {n}! Soy DJ Nat, mitad de semana y vamos bien.'],
       tarde: ['¡Miércoles, {n}! Aquí DJ Nat, ya vamos de bajada.'] },
  4: { tarde: ['¡Jueves, {n}! Aquí DJ Nat, ya casi es viernes.'],
       noche: ['¡Jueves en la noche, {n}! DJ Nat aquí, mañana ya es viernes.'] },
  5: { tarde: ['¡Ya es viernes, {n}! Aquí DJ Nat, esto ya huele a fin de semana.'],
       noche: ['¡Viernes en la noche, {n}! Soy DJ Nat y hoy se arma.'] },
  6: { noche: ['¡Sábado, {n}! DJ Nat aquí, hoy es noche de fiesta.',
               '¡Qué onda, {n}! Aquí DJ Nat, sábado en la noche y con ganas de bailar.'],
       madrugada: ['¡Sábado de desvelo, {n}! Aquí DJ Nat, la fiesta sigue.'] },
}
// Según el clima (Open-Meteo): tienen prioridad cuando aplican
const GREETINGS_WEATHER = {
  lluvia: [
    '¡Qué onda, {n}! Aquí DJ Nat, con esta lluvia se antoja música bonita.',
    '¡{n}! Soy DJ Nat, afuera llueve y aquí adentro ponemos el ambiente.',
    '¡Hey, {n}! DJ Nat aquí, con esta lluvia se antoja cobijita y buenas rolas.',
  ],
  calor: [
    '¡Qué onda, {n}! Aquí DJ Nat, ¡qué calorón! Vamos a refrescarnos con música.',
    '¡{n}! Soy DJ Nat, hace un calor de los buenos, así que súbele.',
    '¡Hey, {n}! DJ Nat aquí, con este calorón las rolas pegan más.',
  ],
  frio: [
    '¡Qué onda, {n}! Aquí DJ Nat, hace un fresquecito, ¿ya con tu cobija?',
    '¡{n}! Soy DJ Nat, con este frío se antoja algo calientito y buena música.',
    '¡Brr, {n}! DJ Nat aquí, hace frío pero la música nos calienta.',
  ],
}
let weather = null   // { city, temp, kind: 'lluvia' | 'calor' | 'frio' | null }
let djCity = load('djCity', '')
async function refreshWeather() { weather = await api.weather(djCity).catch(() => null) }

const partOfDay = (h = new Date().getHours()) => h < 6 ? 'madrugada' : h < 12 ? 'manana' : h < 19 ? 'tarde' : 'noche'
// Sin nombre: "¡{n}! Soy…" → "Soy…", "¡{n}, qué gusto!" → "¡Qué gusto!", ", {n}" se quita
const greetingText = t => userName ? t.replaceAll('{n}', userName)
  : t.replace(/¡\{n\}! /, '').replace(/¡\{n\}, (\S)/, (m, c) => '¡' + c.toUpperCase()).replace(/, \{n\}/g, '')
const greetingsNow = (d = new Date()) => {
  const part = partOfDay(d.getHours())
  return [...GREETINGS[part], ...(GREETINGS_DAY[d.getDay()]?.[part] || []),
          ...(GREETINGS_WEATHER[weather?.kind] || [])].map(greetingText)
}

async function cachedGreeting() {
  if (!dj.ai) return null
  const last = load('djLastGreeting', '')
  const ready = []
  for (const t of greetingsNow()) if (await api.djCached(t)) ready.push(t)
  // Si hay de dónde escoger, no repite el de la vez pasada; los del día especial pesan más
  const pool = ready.length > 1 ? ready.filter(t => t !== last) : ready
  if (!pool.length) return null
  const special = pool.filter(t => !GREETINGS[partOfDay()].map(greetingText).includes(t))
  const pickFrom = special.length && Math.random() < 0.6 ? special : pool
  const text = pickFrom[Math.floor(Math.random() * pickFrom.length)]
  const r = await api.djSay(text, 'gemini')   // en caché: al instante
  if (!r.ok) return null
  save('djLastGreeting', text)
  return { text, file: r.ok }
}

// Graba los que falten, empezando por los de este momento del día, espaciados para no
// chocar con el límite de sesiones por minuto de Google
let greetWarming = false
// Lo que dice al instante mientras arma la respuesta (grabado una vez, como los saludos)
// Variadas a propósito: distintos tonos (prendida, coqueta, chistosa, misteriosa, de radio)
const DJ_ACKS = {
  ask: [
    'Uy, qué buen gusto tienes. Deja te busco lo mejorcito.',
    'Pedido recibido en cabina. Ahorita sale calientito.',
    'Me encanta cuando me pides cosas. Dame chance.',
    'Esa petición está de lujo. Voy por tus rolas.',
    'Anotado, mi rey. Ya estoy revolviendo tu música.',
    'Uff, me late. Déjame hacerte magia.',
    'Ya dijiste. Abriendo el cajón de las joyitas.',
    'Mira nada más qué antojo. Te lo preparo en corto.',
    'Tú pides y la cabina obedece. Ahí voy.',
    'Con esa petición me alegraste el día. Ya te lo armo.',
    'Buenísima idea. Déjame buscar entre tus tesoros.',
    'Petición aceptada. Calentando las bocinas.',
    'Ay, tú sí sabes. Te lo pongo en caliente.',
    'Dame tantito que te voy a lucir con esta.',
  ],
  switch: [
    'Se acabó lo que se daba. Viene algo nuevo.',
    'Cambio de aires. Agárrate que viene otro mood.',
    'Borrón y cuenta nueva. Te tengo otra sorpresa.',
    'Nuevo rumbo, misma energía. Vámonos.',
    'Le damos la vuelta a la página. Escucha esto.',
    'Plot twist en la cabina. Cambiamos de onda.',
    'Ya estuvo de eso. Te llevo para otro lado.',
    'Giro de volante. Agárrate bien.',
    'Cerramos ese capítulo. Abrimos uno nuevo.',
    'Tú mandas. Nos movemos a otra vibra.',
  ],
  next: [
    'Ni se te ocurra irte, que lo bueno apenas empieza.',
    'Aquí la cabina sigue encendida.',
    'Esto apenas va calentando.',
    'Sin pausa y sin prisa, seguimos sonando.',
    'Tu DJ favorita sigue al aire.',
    'Quédate, que todavía tengo joyitas guardadas.',
    'Mientras tú escuches, yo sigo poniendo.',
    'La fiesta no se detiene en esta cabina.',
    'Vamos por la siguiente tanda.',
    'Si te gustó lo anterior, espérate a lo que sigue.',
  ],
}
DJ_ACKS.wait = [
  'Ya casi lo tengo, te va a encantar.',
  'Estoy escogiendo las mejores, aguántame tantito.',
  'Esto vale la pena, ya mero sale.',
  'Le estoy dando el toque final.',
  'Ya lo estoy cargando en las bocinas.',
  'Un segundito más y te lo suelto.',
  'Confía en mí, ya viene lo bueno.',
  'Buscando la rola perfecta para ti.',
]
let djAckLog = []   // las últimas que dijo, para no repetirlas seguido
// Tapa la espera: minifrase al instante y, si al acabar todavía no llega la respuesta, una de
// espera. La música se queda bajita entre las dos. Regresa la promesa para el "after" de djPlay.
async function coverWith(kind) {
  dj.voiceWaiting = false
  const ack = await cachedAck(kind)
  if (!ack) return undefined
  return (async () => {
    await speak(ack.text, ack.file, undefined, { keepDuck: true })
    if (dj.voiceWaiting) return   // la respuesta ya llegó: entra pegadita
    const w = await cachedAck('wait')
    if (w && !dj.voiceWaiting) await speak(w.text, w.file, undefined, { keepDuck: true })
  })()
}

async function cachedAck(kind) {
  if (!dj.ai) return null
  const ready = []
  for (const t of DJ_ACKS[kind]) if (await api.djCached(t)) ready.push(t)
  if (!ready.length) return null
  const fresh = ready.filter(t => !djAckLog.includes(t))
  const pool = fresh.length ? fresh : ready
  const text = pool[Math.floor(Math.random() * pool.length)]
  djAckLog = [text, ...djAckLog].slice(0, 6)
  const r = await api.djSay(text, 'gemini')   // en caché: al instante
  return r.ok ? { text, file: r.ok } : null
}

// Todos los saludos guardados; los de este momento (y los especiales de hoy) primero
const allGreetings = () => [...new Set([...greetingsNow(), ...Object.values(DJ_ACKS).flat(), ...[...Object.values(GREETINGS).flat(),
  ...Object.values(GREETINGS_WEATHER).flat(), ...Object.values(GREETINGS_DAY).flatMap(d => Object.values(d).flat())].map(greetingText)])]

async function warmGreetings() {
  if (greetWarming || !dj.ai) return
  greetWarming = true
  // Las demás frases grabadas se borran a los 7 días; los saludos se quedan
  api.djClean(allGreetings()).catch(() => {})
  try {
    const fails = load('greetFails', {})
    for (const t of allGreetings()) {
      if ((fails[t] || 0) >= 2 || await api.djCached(t)) continue
      while (Date.now() < dj.quietUntil || dj.thinking || dj.speaking) await new Promise(r => setTimeout(r, 5000))
      await api.djSay(t, 'gemini')
      if (!(await api.djCached(t))) { fails[t] = (fails[t] || 0) + 1; save('greetFails', fails) }
      await new Promise(r => setTimeout(r, 30000))
    }
  } finally {
    greetWarming = false
  }
}

// El saludo se graba en segundo plano al abrir la app (con calma y verificado), así al
// darle a DJ Nat suena al instante con su voz. Vale 2 min porque dice la hora (si no, se usa
// un saludo guardado y la hora se dice en vivo).
let welcomeReady = null, welcomePrep = null
function prepareWelcome() {
  if (welcomed || welcomeReady || welcomePrep || !allSongs.length) return
  welcomePrep = (async () => {
    for (let i = 0; i < 50 && !getGenreGroups().genres.length; i++) await new Promise(r => setTimeout(r, 300))
    if (!(await api.geminiStatus()).hasKey || welcomed) return
    dj.ai = true
    // Ya no se escribe el saludo completo al abrir la app (gastaba aunque no prendieras el DJ):
    // al prenderlo suena uno grabado y lo demás se dice en vivo
    await refreshWeather()
  })().finally(() => {
    welcomePrep = null
    setTimeout(warmGreetings, 30000)
  })
}

// "Cambiar vibra" preparado de antemano: mientras suena la música, Nat ya tiene grabada la
// siguiente vibra con su frase. Sólo se guarda si salió con su voz (si no, se hace en vivo).
function prepareAlt() {
  if (!dj.on || !dj.ai || dj.alt || dj.altPrep || !dj.switches) return
  dj.altPrep = (async () => {
    await new Promise(r => setTimeout(r, 20000))   // deja respirar a Google (sesiones por minuto)
    // Si al siguiente le toca decir la hora no se prepara: grabada de antes, la hora salía vieja
    if (!dj.on || Date.now() < dj.quietUntil) return
    const block = newBlock('switch', dj.vibe ? [dj.vibe.key] : [])
    if (!block) return
    const line = await djLine('switch', block, { noTime: true })
    const r = await api.djSay(line, 'gemini')
    if (r.ok && dj.on) dj.alt = { block, line, file: r.ok }
  })().finally(() => { dj.altPrep = null })
}

function djStop() {
  dj.on = false
  djQueued = null
  dj.next = null
  dj.prepWip = null
  dj.alt = null
  dj.vibe = null
  djAudio.pause()
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  activeStream?.cancel()
  activeStream = null
  dj.speaking = dj.thinking = false
  duck(false)
  renderDjPanel()
}

// Desde que empieza la última canción del bloque se prepara el siguiente (frase + voz).
// ahead = lo que falta de la canción: si le toca decir la hora, dice la de cuando va a hablar
function djPrepare(ahead = 0) {
  if (dj.next || (dj.prep && dj.prepWip)) return dj.prep
  if (dj.sinceHello >= 2 && !ahead) return null
  const wip = {}   // lo que va: { block, line }
  dj.prepWip = wip
  dj.prep = (async () => {
    const block = await continueBlock()
    if (!block) return
    block.ahead = ahead
    block.speakAt = Date.now() + ahead
    wip.block = block
    const line = await djLine(block.kind, block)
    wip.line = line
    const file = await djVoice(line)
    if (!dj.on || dj.prepWip !== wip) return   // ya se usó en vivo
    dj.next = { block, line, file }
  })().catch(() => {})   // si algo falla, se arma en vivo al acabar el bloque
  const p = dj.prep
  p.finally(() => { if (dj.prep === p) dj.prep = null; if (dj.prepWip === wip) dj.prepWip = null })
  return p
}

// Un solo cambio de bloque a la vez. Lo que pidas mientras Nat habla (cambiar vibra, brincar
// la última canción) se hace en cuanto termina: antes se ignoraba y parecía que no respondía.
// Sólo se guarda el último (varios clics no piden bloques de más).
let djChanging = false, djQueued = null
async function djChange(fn) {
  if (djChanging) { djQueued = fn; return }
  djChanging = true
  try { await fn() } finally { djChanging = false }
  const q = djQueued
  djQueued = null
  if (q && dj.on) djChange(q)
}

// La frase preparada dice una hora que ya no cuadra (adelantaste o pausaste la canción)
// Lo que falta para que acabe el bloque: lo que queda de esta canción + las que siguen
function blockLeftMs() {
  const now = isFinite(audio.duration) ? (audio.duration - audio.currentTime) * 1000 : 0
  return now + upcoming(99).reduce((a, i) => a + (filtered[i]?.duration || 0) * 1000, 0)
}

const staleNext = (at = Date.now()) => !!dj.next?.block.hora && dj.next.block.hora !== clockText(at)

function djNextBlock() {
  return djChange(async () => {
    if (playContext === DJ_CTX && upcoming(1).length) return
    if (!dj.next && dj.prep) {
      dj.thinking = true   // te avisa que está preparando lo que sigue
      renderDjPanel()
      // Máximo 1 s: grabar la frase verificada tarda ~10 s; si no está, se dice en vivo
      await Promise.race([dj.prep, new Promise(r => setTimeout(r, 1000))])
    }
    // Te brincaste la última canción antes de que la voz estuviera lista: mismas rolas, y el
    // texto que ya tenía (si lo tenía) se dice en vivo, con una frase corta grabada mientras
    if (!dj.next && dj.prepWip?.block) {
      const { block, line } = dj.prepWip
      dj.prepWip = null
      const keep = line && (!block.hora || block.hora === clockText(Date.now()))
      if (!keep) { block.ahead = 0; block.timed = block.hora = undefined }
      await djPlay(block, keep ? { line } : undefined, await coverWith('next'))
      return
    }
    // La hora ya no cuadra (te brincaste canciones): mismas rolas con la frase sin hora (ya
    // grabada, al instante); si no hay, se dice en vivo con la hora de ahorita
    if (staleNext()) {
      const { block, plain } = dj.next
      dj.next = null
      block.ahead = 0
      block.timed = block.hora = undefined
      await djPlay(block, plain || undefined, plain ? undefined : await coverWith('next'))
      return
    }
    if (dj.next) { const { block, line, file } = dj.next; await djPlay(block, { line, file }); return }
    const block = await continueBlock()
    if (!block) return
    await djPlay(block, undefined, await coverWith('next'))
  })
}

function djSwitch() {
  dj.switches = (dj.switches || 0) + 1
  return djChange(async () => {
    const alt = dj.alt
    dj.alt = null
    if (alt && alt.block.vibe.key !== dj.vibe?.key) { await djPlay(alt.block, { line: alt.line, file: alt.file }); return }
    const block = newBlock('switch', dj.vibe ? [dj.vibe.key] : [])
    if (!block) return
    await djPlay(block, undefined, await coverWith('switch'))
  })
}

// ── Peticiones al DJ ("ponme algo pa la peda pero sin reggaetón") ─────────────
const REQ_SCHEMA = {
  type: 'object',
  properties: {
    reply:      { type: 'string', description: 'Lo que DJ Nat le contesta al usuario en voz alta: 2 o 3 frases con plática' },
    title:      { type: 'string', description: 'Nombre corto de la vibra que vas a poner' },
    genres:     { type: 'array', items: { type: 'string' }, description: 'ids de géneros a incluir' },
    moods:      { type: 'array', items: { type: 'string' }, description: 'ids de moods a incluir' },
    exclude:    { type: 'array', items: { type: 'string' }, description: 'ids de géneros o moods a evitar' },
    artists:    { type: 'array', items: { type: 'string' }, description: 'artistas a incluir, escritos igual que en la lista' },
    similar_to: { type: 'array', items: { type: 'string' }, description: 'artistas o canciones a los que se debe parecer (todos los que mencione), o vacío' },
    songs:      { type: 'array', description: 'canciones específicas que pidió por su nombre, en el orden en que las pidió',
                  items: { type: 'object', properties: { title: { type: 'string' }, artist: { type: 'string' } }, required: ['title'] } },
  },
  required: ['reply', 'title'],
}

// Busca en la biblioteca una canción pedida por nombre ("pollypocket", "Gil de Milo J"):
// sin importar mayúsculas, espacios ni "(Visualizer)". El título exacto gana sobre uno que
// sólo lo contiene ("Gil" antes que "El Gil de Tu Ex"); si dijo el artista, pesa mucho.
function findSong(title, artist = '') {
  const n = s => fold(s).replace(/[^a-z0-9ñ]/g, '')
  const want = n(cleanTitle(title)), who = n(artist)
  if (want.length < 2) return null
  let best = null, bestScore = 0
  for (const s of allSongs) {
    const t = n(cleanTitle(s.title))
    let score = t === want ? 100 : t.length >= 3 && want.includes(t) ? 40 + t.length : want.length >= 3 && t.includes(want) ? 50 : 0
    if (!score) continue
    if (who && splitArtists(s.artist).some(a => n(a) === who || n(a).includes(who))) score += 60
    // Escrito igualito, espacios incluidos ("pollypocket" → POLLYPOCKET, no "Polly Pocket")
    if (fold(cleanTitle(s.title)).trim() === fold(title).trim()) score += 15
    score += Math.min(10, affinity(s))   // entre duplicados, la que más escuchas
    if (score > bestScore) { best = s; bestScore = score }
  }
  return best
}

function mentionedArtists(text) {
  const f = ' ' + fold(text).replace(/[^a-z0-9ñ]+/g, ' ') + ' '
  return getGroups().artistList.filter(a => {
    const n = fold(a.name).replace(/[^a-z0-9ñ]+/g, ' ').trim()
    return n.length >= 3 && a.name !== 'Artista desconocido' && f.includes(' ' + n + ' ')
  }).map(a => a.name)
}

function catalogText(text = '') {
  const gg = getGenreGroups()
  const groups = [...gg.genres, ...gg.moods].map(g => `${g.key} (${g.name}, ${g.songs.length})`).join('; ')
  const artists = getGroups().artistList.filter(a => a.name !== 'Artista desconocido')
    .sort((a, b) => b.songs.length - a.songs.length).slice(0, 150).map(a => a.name).join(', ')
  const named = mentionedArtists(text)
  return `Géneros y moods disponibles (id, nombre, canciones): ${groups}\nArtistas del usuario: ${artists}` +
    (named.length ? `\nArtistas que mencionó (están en su biblioteca): ${named.join(', ')}` : '')
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
  const like = /\b(?:como|tipo|estilo)\s+(?:de\s+)?(.+)$/.exec(main)
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
    similar_to: like && mentionedArtists(like[1]).length ? mentionedArtists(like[1]) : like ? like[1].split(/\s+(?:o|y|ó)\s+|,/).map(x => x.trim()).filter(Boolean) : [],
    // Si no nombró estilo ni artista, quizá es el nombre de una canción ("pon pollypocket")
    songs: inc.length || artists.length || like ? []
      : [{ title: head.replace(/^\s*(ponme|pon|quiero|reproduce|toca|ponte)\s+(la\s+)?(cancion|rola)?\s*(de\s+)?/, '') }],
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
  const refs = [plan.similar_to || []].flat().filter(Boolean)
  if (refs.length) {
    const sim = new Set(), refGenres = new Set()
    for (const ref of refs) {
      // Primero como artista de tu biblioteca (exacto); si no, lo que encuentre la búsqueda
      const own = allSongs.filter(s => splitArtists(s.artist).some(a => fold(a) === fold(ref)))
      const b = own.length ? null : bestMatch(ref, searchMatches(ref))
      const seeds = own.length ? own : b?.kind === 'song' ? [b.song] : b?.songs ? [...b.songs] : []
      seeds.sort((x, y) => affinity(y) - affinity(x))
      for (const s of seeds) sim.add(s)   // sus propias rolas también van
      for (const seed of seeds.slice(0, 2)) for (const s of await similarSongs(seed)) sim.add(s)
      for (const x of seeds) { const g = mainGenre(x); if (g) refGenres.add(g) }
    }
    const sameGenre = [...sim].filter(s => refGenres.has(mainGenre(s)))
    if (sameGenre.length >= 8) { sim.clear(); for (const s of sameGenre) sim.add(s) }
    if (sim.size) {
      const keep = pool ? [...sim].filter(s => pool.has(s)) : []
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
  dj.quietUntil = Date.now() + 60000
  dj.log.push({ who: 'yo', text })
  api.djChatLog('Tú', text)
  dj.thinking = true
  renderDjPanel()
  // Mientras arma la respuesta dice algo corto ya grabado ("¡Sale! Ahorita te lo busco")
  const after = await coverWith('ask')
  let plan = null
  if (dj.ai) {
    const r = await api.djThink(
      DJ_SYSTEM + ' Ahora el usuario te pide algo: elige qué poner usando SÓLO los ids y artistas de la lista y ' +
      'contéstale sin saludar ni presentarte. Aquí sí cotorrea: de 2 a 3 frases (máximo 45 palabras), con ' +
      'plática de locutora (comenta su elección, échale porras, una broma o un comentario del mood)' +
      (userName ? `, y dile su nombre (${userName}) de forma natural` : '') + '. ' +
      'Si pide música para una actividad o un momento (bañarse, cocinar, limpiar, manejar, estudiar, hacer ejercicio, ' +
      'dormir, una fiesta, un desamor…), tú eliges los géneros y moods que le queden (ej. bañarse → algo alegre o pa ' +
      'cantar; limpiar → con energía; dormir → tranqui); nunca dejes genres y moods vacíos. ' +
      'Si pide algo "como", "parecido a", "estilo" o "tipo" uno o varios artistas o canciones, pon TODOS esos nombres en similar_to y NO en artists; ' +
      'usa artists sólo si pide escuchar a ese artista. Si pide una o varias canciones por su nombre ("pon Gil", ' +
      '"ponme pollypocket"), ponlas en songs tal cual las escribió (con su artista si lo dijo).',
      `${catalogText(text)}\n\nPetición del usuario: ${text}`, REQ_SCHEMA, true)
    if (r.ok) plan = r.ok
  }
  if (!plan) plan = keywordPlan(text)
  // Canciones pedidas por nombre: van primero, tal cual
  const wanted = [...new Set((plan.songs || []).map(x => findSong(x.title, x.artist)).filter(Boolean))]
  let pool = await poolFromPlan(plan)
  // Después de las pedidas, rolas que suenan parecido (si no pidió también un estilo)
  if (wanted.length && pool.length < 5) pool = await similarSongs(wanted[0])
  dj.thinking = false
  // Si aun así no encontró nada, algo con buena vibra de tu música (nunca "no encontré")
  if (!wanted.length && pool.length < 3) {
    const gg = getGenreGroups()
    const good = ['m-feliz', 'm-bailar', 'm-energia'].map(k => gg.map.get(k)).find(m => m?.songs.length >= 10)
    pool = good ? good.songs : (pickVibe()?.songs || allSongs)
    if (!plan.reply) plan.reply = '¡Va! Te armé algo con buena vibra de tu música.'
  }
  // "tipo Cachirula o Emi Blue": abre una rola de cada uno (de las que más escuchas) y luego parecidas
  for (const ref of [plan.similar_to || []].flat().filter(Boolean).slice(0, 2)) {
    const own = pool.filter(s => !wanted.some(w => songKey(w) === songKey(s)) && splitArtists(s.artist).some(a => fold(a) === fold(ref)))
    const pick = own.sort((x, y) => affinity(y) - affinity(x))[Math.floor(Math.random() * Math.min(2, own.length))]
    if (pick) wanted.push(pick)
  }
  const rest = pool.filter(s => !wanted.some(w => songKey(w) === songKey(s)))
  const songs = [...wanted, ...buildBlock(rest, Math.max(3, 6 - wanted.length))]
  const block = { kind: 'request', vibe: { key: 'req:' + fold(plan.title || text), name: plan.title || text, songs: rest }, songs }
  // La respuesta se escribió antes de elegir canciones: se le agrega la que de verdad
  // abre, para que la voz no tenga hueco que rellenar inventando un artista
  const first = block.songs[0], artist = splitArtists(first.artist)[0] || ''
  let line = cleanLine(plan.reply || `¡Va! Te pongo ${block.vibe.name}.`)
  const title = cleanTitle(first.title)
  if (!fold(line).includes(fold(title))) line += ` Arrancamos con ${title}${artist ? ` de ${artist}` : ''}.`
  if (rightMode !== 'dj') setRight('dj')
  await djPlay(block, { line }, after)
}

// ── Panel del DJ ──────────────────────────────────────────────────────────────
// Orbe chiquito de la barra: estado del DJ y, mientras habla, late con su voz
let miniRaf = 0
function syncMiniOrb() {
  const b = $('btn-dj')
  b.classList.toggle('live', dj.on)
  b.classList.toggle('thinking', dj.thinking)
  b.classList.toggle('speaking', dj.speaking)
  if (dj.speaking && !miniRaf) {
    let lv = 0
    const step = () => {
      if (!dj.speaking) { miniRaf = 0; b.style.setProperty('--lv', 0); return }
      const v = voiceLevel()
      lv += (v - lv) * (v > lv ? 0.5 : 0.15)
      b.style.setProperty('--lv', lv.toFixed(3))
      miniRaf = requestAnimationFrame(step)
    }
    miniRaf = requestAnimationFrame(step)
  }
}

function renderDjPanel() {
  queueMicrotask(syncMiniOrb)
  if (rightMode !== 'dj') return
  queueMicrotask(startOrb)   // al arrancar la app el orbe todavía no existe
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

// ── Orbe de Nat ───────────────────────────────────────────────────────────────
// Tres manchas de color que se deforman (suma de senos), con brillo. El volumen de la voz
// las agranda y las agita; pensando giran más rápido. Sólo se dibuja con el panel abierto.
const orb = { cv: $('dj-orb-cv'), level: 0, think: 0, t: 0, last: 0, raf: 0 }
const ORB_LAYERS = [
  { c: ['#ff5a4f', '#c4101f'], r: 0.78, spd: 0.9, ph: 0 },
  { c: ['#ff2f6a', '#8a0a2a'], r: 0.70, spd: -1.2, ph: 2.1 },
  { c: ['#ffa04a', '#e8333c'], r: 0.58, spd: 1.6, ph: 4.2 },
]
const orbBuf = new Float32Array(1024)
function voiceLevel() {
  if (!dj.speaking) return 0
  voiceAnalyser.getFloatTimeDomainData(orbBuf)
  let sum = 0
  for (let i = 0; i < orbBuf.length; i++) sum += orbBuf[i] * orbBuf[i]
  return Math.min(1, Math.sqrt(sum / orbBuf.length) * 5)
}
// El orbe se ve en el panel del DJ, y en el celular también grande en Reproduciendo mientras Nat habla
const orbVisible = () => rightMode === 'dj' || document.body.classList.contains('m-dj-talk')
function drawOrb(now) {
  orb.raf = 0
  if (!orbVisible()) return
  const dt = Math.min(0.05, (now - (orb.last || now)) / 1000)
  orb.last = now
  const cv = orb.cv, dpr = window.devicePixelRatio || 1
  const size = Math.round(cv.clientWidth * dpr)
  if (!size) { orb.raf = requestAnimationFrame(drawOrb); return }
  if (cv.width !== size) cv.width = cv.height = size
  const lv = voiceLevel()
  orb.level += (lv - orb.level) * (lv > orb.level ? 0.5 : 0.12)   // sube rápido, baja suave
  orb.think += ((dj.thinking ? 1 : 0) - orb.think) * 0.05
  orb.t += dt * (0.5 + orb.think * 1.8 + orb.level * 2.5)
  const g = cv.getContext('2d'), c = size / 2, base = size * 0.36
  g.clearRect(0, 0, size, size)
  g.globalCompositeOperation = 'screen'
  const breathe = 1 + Math.sin(now / 1400) * 0.025
  for (const L of ORB_LAYERS) {
    const R = base * L.r * breathe * (1 + orb.level * 0.28)
    const wob = 0.05 + orb.level * 0.22 + orb.think * 0.06
    const t = orb.t * L.spd + L.ph
    g.beginPath()
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const k = 1 + wob * (0.55 * Math.sin(3 * a + t) + 0.3 * Math.sin(5 * a - t * 1.3) + 0.15 * Math.sin(2 * a + t * 0.7))
      const x = c + Math.cos(a + t * 0.2) * R * k + Math.cos(t) * base * 0.08
      const y = c + Math.sin(a + t * 0.2) * R * k + Math.sin(t * 1.1) * base * 0.08
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    const grad = g.createRadialGradient(c - R * 0.3, c - R * 0.3, R * 0.1, c, c, R * 1.25)
    grad.addColorStop(0, L.c[0])
    grad.addColorStop(0.55, L.c[1] + 'cc')
    grad.addColorStop(1, L.c[1] + '00')
    g.fillStyle = grad
    g.shadowColor = L.c[1]
    g.shadowBlur = size * (0.06 + orb.level * 0.08)
    g.globalAlpha = 0.6
    g.fill()
  }
  g.globalAlpha = 1
  g.shadowBlur = 0
  g.globalCompositeOperation = 'source-over'
  orb.raf = requestAnimationFrame(drawOrb)
}
function startOrb() { if (!orb.raf && orbVisible()) orb.raf = requestAnimationFrame(drawOrb) }

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
    $('np-lyrics').hidden = true
    inner.innerHTML = '<div class="no-lyrics">Esta canción no tiene letra.<small>Sólo se muestran letras incrustadas en el MP3 (USLT / LRC).</small></div>'
    return
  }

  lyricLines = parseLrc(text)
  const sample = (lyricLines.length ? lyricLines.map(l => l.text) : text.split('\n').map(x => x.trim()))
    .filter(t => t && !/^\[/.test(t)).slice(0, 4)
  $('np-lyrics').hidden = !sample.length
  $('np-lyrics-text').innerHTML = sample.map(t => `<div>${esc(t)}</div>`).join('')

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
  ctx2d.fillStyle = '#e8333c'

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
audio.addEventListener('ended', () => {
  if (sleepTimer?.endOfSong) { sleepTimer = null; return }   // apagado automático
  if (repeatMode !== 2) nextSong()
})
// Últimos 15 segundos de la última canción del bloque: Nat ya va armando lo que sigue
// (escribir y grabar la frase tarda de 3 a 8 s)
audio.addEventListener('timeupdate', () => {
  if (!dj.on || playContext !== DJ_CTX || upcoming(1).length || repeatMode === 2) return
  const left = audio.duration - audio.currentTime
  if (left > 0 && left <= 15) {
    if (staleNext(Date.now() + left * 1000)) dj.next = null   // se rehace con la hora buena
    djPrepare(left * 1000)
  }
})
audio.addEventListener('play', () => {
  setPlayState(true)
  if (!spectrumRafId) drawSpectrum()
  if (!seekRafId)     rafLoop()
})
audio.addEventListener('pause', () => setPlayState(false))   // el Canvas sigue en loop aunque pauses
audio.addEventListener('playing', () => canvasCmd('playVideo'))

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
      title: fileName(p).replace(/\.(mp3|m4a|flac|ogg|opus|wav|aac)$/i, '').replace(/^\d+\s*[-–.]\s*/, ''),
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
  prepareWelcome()
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
$('app-logo').addEventListener('click', () => navigate({ name: 'home' }))
$('btn-back').addEventListener('click', goBack)
$('btn-fwd').addEventListener('click',  goForward)

$('col-play').addEventListener('click',        playCurrentView)
$('col-sticky-play').addEventListener('click', playCurrentView)
// Aleatorio de la página: si no está sonando esta lista, la arranca en aleatorio (como Spotify);
// si ya está sonando, sólo prende o apaga el modo aleatorio
$('col-shuffle').addEventListener('click', () => {
  if (playContext?.key === viewKey(view) && currentSong) { toggleShuffle(); return }
  if (!shuffle) toggleShuffle()
  playList(viewSongs, null, { key: viewKey(view), title: viewTitle })
})

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

// Para la versión de celular (mobile-ui.js), que no ve las variables de este archivo
window.sd = {
  get currentSong() { return currentSong },
  get playContext() { return playContext },
  get shuffle() { return shuffle },
  get lyricNow() { return curLyric >= 0 ? lyricLines[curLyric]?.text || '' : '' },
  get lyricLines() { return lyricLines },   // [{ time, text }] si la letra trae tiempos
  get lyricIdx() { return curLyric },
  get allSongs() { return allSongs },
  get sleepTimer() { return sleepTimer && sleepLabel() },
  openSongMenu: (...a) => openSongMenu(...a), addToQueue: s => addToQueue(s),
  moveUpcoming: (a, b) => moveUpcoming(a, b), setSleepTimer: m => setSleepTimer(m),
  openSleepMenu: () => openSleepMenu(), toggleShuffle: () => toggleShuffle(),
  get dj() { return { on: dj.on, ai: dj.ai, speaking: dj.speaking, thinking: dj.thinking, vibe: dj.vibe?.name || '' } },
  djStart: () => djStart(), djStop: () => djStop(), djSwitch: () => djSwitch(), djAsk: t => djAsk(t),
  startOrb: () => startOrb(),
}

// ── Menú contextual (clic derecho en una canción) ────────────────────────────
const ctxMenu = $('ctx-menu')

function openSongMenu(song, x, y) {
  const liked = likedPaths.has(song.path)
  const items = [
    ['like',  liked ? 'Quitar de Tus me gusta' : 'Agregar a Tus me gusta'],
    ['queue', 'Agregar a la fila'],
    ['goqueue', 'Ir a la fila'],
    ...(splitArtists(song.artist).length ? [['artist', 'Ir al artista']] : []),
    ['album', 'Ir al álbum'],
    ['radio', 'Ir a radio de la canción'],
    ['sleep', 'Apagado automático' + (sleepTimer ? ' • ' + sleepLabel() : '')],
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

// Opciones del apagado automático (en el mismo menú)
function openSleepMenu() {
  const opts = [[5, '5 minutos'], [10, '10 minutos'], [15, '15 minutos'], [30, '30 minutos'],
                [45, '45 minutos'], [60, '1 hora'], [-1, 'Al terminar la canción'],
                ...(sleepTimer ? [[0, 'Desactivar apagado automático']] : [])]
  ctxMenu.innerHTML = '<div class="ctx-info">Apagado automático' + (sleepTimer ? ' • ' + esc(sleepLabel()) : '') + '</div>' +
    opts.map(([m, t]) => `<button data-sleep="${m}">${t}</button>`).join('')
  ctxMenu._song = null
  ctxMenu.hidden = false
}
ctxMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-sleep]')
  if (!b) return
  closeMenu()
  setSleepTimer(+b.dataset.sleep)
})

ctxMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-act]')
  const s = ctxMenu._song
  if (!b || !s) return
  closeMenu()
  if (b.dataset.act === 'radio')  startRadio(s)
  if (b.dataset.act === 'queue')  addToQueue(s)
  if (b.dataset.act === 'goqueue') { if (rightMode !== 'queue') setRight('queue') }
  if (b.dataset.act === 'sleep')  openSleepMenu()
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
  $('dj-city').value = djCity
  $('canvas-on').checked = canvasOn
  $('lfm-msg').className = $('gem-msg').className = 'modal-msg'
  $('lfm-key').value = $('gem-key').value = ''
  $('settings-adv').open = false
}
function closeSettings() { $('settings').hidden = true }

// Guarda nombre y bienvenida, y sólo las keys que se escribieron (cada una se comprueba antes)
async function saveSettings() {
  userName = $('dj-name').value.trim()
  if ($('dj-city').value.trim() !== djCity) {
    djCity = $('dj-city').value.trim()
    save('djCity', djCity)
    refreshWeather()
  }
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
    else { ok = false; msg.textContent = r.error; msg.className = 'modal-msg err'; $('settings-adv').open = true }
  }
  $('lfm-save').disabled = false
  if (ok) closeSettings()
}

$('btn-settings').addEventListener('click', openSettings)
$('canvas-on').addEventListener('change', e => {
  canvasOn = e.target.checked
  save('canvasOn', canvasOn)
  updateCanvas()
})
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
