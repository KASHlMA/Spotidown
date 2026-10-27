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

// ── Navegación ────────────────────────────────────────────────────────────────
function viewKey(v) { return `${v.name}:${v.key ?? v.q ?? ''}` }
function viewKind(v) { return v.name === 'home' || v.name === 'lyrics' ? v.name : 'collection' }

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
  for (const k of ['home', 'collection', 'lyrics']) $('view-' + k).hidden = k !== kind
  $('btn-home').classList.toggle('active', kind === 'home')
  $('btn-lyrics').classList.toggle('active', kind === 'lyrics')
  $('btn-back').disabled = !histBack.length
  $('btn-fwd').disabled  = !histFwd.length
  if (view.name === 'search') {
    $('search').value = view.q
    $('search-clear').hidden = false
  } else if (kind !== 'lyrics') {
    $('search').value = ''
    $('search-clear').hidden = true
  }

  if (kind === 'home') buildHome()
  else if (kind === 'collection') openCollection()
  else { curLyric = -1; syncLyrics(audio.currentTime, true) }
  markSidebar()
}

// ── Sidebar: Tu biblioteca ────────────────────────────────────────────────────
function renderSidebar() {
  document.querySelectorAll('.sb-chips .chip').forEach(c =>
    c.classList.toggle('active', c.dataset.filter === libFilter))

  const ul = $('lib-list')
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

  const g = getGroups()
  if (libFilter !== 'album')
    g.artistList.forEach(a => add(`artist:${a.key}`, { name: 'artist', key: a.key }, a.name, 'Artista',
      th => fillCover(th, a.songs, I.person), true))
  if (libFilter !== 'artist')
    g.albumList.forEach(a => add(`album:${a.key}`, { name: 'album', key: a.key }, a.name, `Álbum • ${a.artist || 'Varios artistas'}`,
      th => fillCover(th, a.songs, I.disc)))

  ul.appendChild(frag)
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
    { title: 'Tus me gusta', cls: 'tile-liked', icon: I.heartFill,
      open: () => navigate({ name: 'liked' }), play: () => playList(likedSongs(), null, LIKED_CTX) },
    { title: 'Todas las canciones', cls: 'tile-songs', icon: I.note,
      open: () => navigate({ name: 'songs' }), play: () => playList(allSongs, null, SONGS_CTX) },
    ...(recents.length ? recents : allSongs).slice(0, 6).map(s => ({
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
    else { img.classList.add(t.cls); img.innerHTML = svg(t.icon) }
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
  fillShelf('home-artists', g.artistList.filter(a => a.name !== 'Artista desconocido').sort(bySize).slice(0, 12))
  fillShelf('home-albums', [...g.albumList].sort(bySize).slice(0, 12))
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
    case 'search': {
      const q = v.q.toLowerCase()
      const songs = allSongs.filter(s => `${s.title}\n${s.artist}\n${s.album}`.toLowerCase().includes(q))
      return { type: 'Resultados de búsqueda', title: v.q, songs, icon: I.search, color: [60, 60, 60],
               empty: `No se encontraron resultados para "${v.q}".` }
    }
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
  if (c.tile) {
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
    : 'No hay más canciones en la cola'
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
  $('rp-np').hidden    = rightMode !== 'np'
  $('rp-queue').hidden = rightMode !== 'queue'
  $('rp-title').textContent = rightMode === 'queue'
    ? 'Cola'
    : (playContext?.title || currentSong?.album || 'Reproduciendo')
  if (rightMode === 'queue') renderQueue()
  if (rightMode === 'np') renderNpNext()
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
}

// ── Reproducción ──────────────────────────────────────────────────────────────
function playList(songs, idx, ctx) {
  if (!songs.length) return
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
  playList(viewSongs, i, ctx)
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

  renderList()
  markSidebar()
  renderRight()

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
}

function refreshLibraryViews() {
  renderSidebar()
  const kind = viewKind(view)
  if (kind === 'home') buildHome()
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

// Links a artista / álbum en cualquier parte de la UI
document.addEventListener('click', e => {
  const a = e.target.closest('[data-artist]')
  if (a) { e.stopPropagation(); navigate({ name: 'artist', key: a.dataset.artist }); return }
  const al = e.target.closest('[data-album]')
  if (al) { e.stopPropagation(); navigate({ name: 'album', key: al.dataset.album }) }
}, true)

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
      if (view.name === 'search') { view = { name: 'search', q }; openCollection() }
      else navigate({ name: 'search', q })
    } else if (view.name === 'search') {
      goBack()
    }
  }, 250)
})

$('search').addEventListener('keydown', e => {
  if (e.key === 'Enter' && view.name === 'search' && viewSongs.length) playFromView(0)
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
