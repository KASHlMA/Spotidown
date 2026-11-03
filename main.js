const { app, BrowserWindow, ipcMain, shell, nativeImage, utilityProcess, session, webFrameMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const createLastfm = require('./lastfm')
const createGemini = require('./gemini')

const MUSIC_DIR = app.getPath('music')
const CACHE_PATH = path.join(app.getPath('userData'), 'music-cache.json')
const lastfm = createLastfm(app.getPath('userData'))
const gemini = createGemini(app.getPath('userData'))
const voice  = require('./voice')(app.getPath('userData'))

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 800, minHeight: 560,
    frame: false,
    title: 'Spotidown',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })
  win.loadFile('index.html')
  // Canvas: dentro del reproductor de YouTube se esconde todo lo suyo (ícono de pausa al
  // brincar, títulos, logos, subtítulos, sugerencias, círculo de carga) y el pedazo se repite
  // directo en el <video> (sin comandos, que hacen aparecer los íconos)
  win.webContents.on('did-frame-finish-load', (_, isMain, pid, rid) => {
    if (isMain) return
    const f = webFrameMain.fromId(pid, rid)
    if (!f || !/youtube-nocookie\.com\/embed\//.test(f.url)) return
    const at = Number(new URL(f.url).searchParams.get('start')) || 0
    const len = Math.max(4, (Number(new URL(f.url).searchParams.get('end')) || at + 11) - at - 2)
    f.executeJavaScript(`(() => {
      const st = document.createElement('style')
      // Se esconde todo menos el video y lo que lo contiene (la interfaz de YouTube cambia de
      // nombres seguido: player-controls, play-pause-icon, spinner, ytp-…)
      st.textContent = 'body *:not(video):not(:has(video)){display:none!important}'
      document.head.appendChild(st)
      setInterval(() => {
        const v = document.querySelector('video')
        if (v && v.currentTime >= ${at + len} - 0.2) v.currentTime = ${at}
      }, 100)
    })()`).catch(() => {})
  })
}

app.whenReady().then(() => {
  // El reproductor incrustado de YouTube no carga sin "Referer" (la app es file://)
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube-nocookie.com/*', '*://*.youtube.com/*'] },
    (d, cb) => { d.requestHeaders.Referer = 'https://spotidown.local/'; cb({ requestHeaders: d.requestHeaders }) })
  createWindow()
  createShortcut()
  watchMusicDir()
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { lastfm.flush(); saveAudio() })

// ── Acceso directo en escritorio ──────────────────────────────────────────────
function createShortcut() {
  try {
    const desktop  = app.getPath('desktop')
    const shortcut = path.join(desktop, 'Music Player.lnk')
    if (!fs.existsSync(shortcut)) {
      shell.writeShortcutLink(shortcut, {
        target:      process.execPath,
        args:        `"${app.getAppPath()}"`,
        description: 'Music Player',
        iconPath:    process.execPath,
        iconIndex:   0,
      })
    }
  } catch (e) { console.error('createShortcut error:', e.message) }
}

// ── Watcher: recarga cuando se añade música ───────────────────────────────────
// mtime de cada MP3 según el último escaneo. En Windows fs.watch también avisa
// cuando un archivo sólo se LEE (fecha de último acceso), así que se compara el
// mtime para no re-escanear la biblioteca cada vez que se analiza una canción.
const knownMtimes = new Map()

function watchMusicDir() {
  let debounce = null
  const notify = () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('library-changed')
    }, 3000)
  }
  try {
    fs.watch(MUSIC_DIR, { recursive: true }, (_, filename) => {
      if (!filename?.toLowerCase().endsWith('.mp3')) return
      const full = path.join(MUSIC_DIR, filename)
      fs.promises.stat(full)
        .then(st => { if (knownMtimes.get(full) !== st.mtimeMs) notify() })
        .catch(() => { if (knownMtimes.has(full)) notify() })   // se borró o se renombró
    })
  } catch (e) { console.error('watchMusicDir error:', e.message) }
}

// ── IPC: devolver directorio de música al renderer ────────────────────────────
ipcMain.handle('get-music-dir', () => MUSIC_DIR)

// ── IPC: caché de metadata ────────────────────────────────────────────────────
ipcMain.handle('load-cache', async () => {
  try {
    const data = await fs.promises.readFile(CACHE_PATH, 'utf8')
    return JSON.parse(data)
  } catch {
    return { version: 1, songs: {} }
  }
})

ipcMain.handle('save-cache', async (_, cache) => {
  try {
    await fs.promises.writeFile(CACHE_PATH, JSON.stringify(cache), 'utf8')
  } catch (e) {
    console.error('save-cache error:', e.message)
  }
})

// ── IPC: escanear directorio de música ───────────────────────────────────────
ipcMain.handle('scan-music', async () => {
  if (!fs.existsSync(MUSIC_DIR)) return []
  const results = []
  async function walk(d) {
    try {
      const entries = await fs.promises.readdir(d, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(d, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.name.toLowerCase().endsWith('.mp3')) {
          try {
            const stat = await fs.promises.stat(full)
            results.push({ path: full, mtime: stat.mtimeMs })
          } catch {
            results.push({ path: full, mtime: 0 })
          }
        }
      }
    } catch (e) { console.error('scan-music walk error:', d, e.message) }
  }
  await walk(MUSIC_DIR)
  results.sort((a, b) => a.path.localeCompare(b.path))
  knownMtimes.clear()
  for (const r of results) knownMtimes.set(r.path, r.mtime)
  return results
})

// Portadas reducidas a 400px en JPEG: una portada incrustada puede pesar varios MB
// y se guarda en memoria para cada canción de la biblioteca
function coverToDataUrl(pic) {
  const buf = Buffer.from(pic.data)
  try {
    const img = nativeImage.createFromBuffer(buf)
    if (!img.isEmpty()) {
      const out = img.getSize().width > 400 ? img.resize({ width: 400, quality: 'good' }) : img
      return 'data:image/jpeg;base64,' + out.toJPEG(85).toString('base64')
    }
  } catch {}
  return `data:${pic.format};base64,${buf.toString('base64')}`
}

// ── IPC: leer metadata de un MP3 ─────────────────────────────────────────────
ipcMain.handle('read-meta', async (_, filePath) => {
  try {
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(filePath, { duration: true, skipCovers: false })
    const tag  = meta.common

    const coverBase64 = tag.picture?.length ? coverToDataUrl(tag.picture[0]) : null

    // Buscar letras en múltiples lugares
    let lyrics = ''

    // 1) common.lyrics (estructura varía por versión)
    if (tag.lyrics?.length) {
      const l = tag.lyrics[0]
      lyrics = typeof l === 'string' ? l : (l?.text || '')
    }

    // 2) Tags nativos — buscar USLT en ID3v2.x
    if (!lyrics) {
      for (const fmt of Object.keys(meta.native || {})) {
        const uslt = meta.native[fmt].find(t => t.id === 'USLT')
        if (uslt) {
          const v = uslt.value
          lyrics = typeof v === 'string' ? v : (v?.text || '')
          break
        }
      }
    }

    return {
      title:    tag.title  || path.basename(filePath, '.mp3').replace(/^\d+\s*[-–.]\s*/, ''),
      artist:   (tag.artists || [tag.artist]).filter(Boolean).join(', ') || '',
      album:    tag.album  || '',
      duration: meta.format.duration || 0,
      cover:    coverBase64,
      lyrics: typeof lyrics === 'string' ? lyrics : '',
    }
  } catch (e) {
    console.error('read-meta ERROR:', filePath, e.message)
    return { title: path.basename(filePath, '.mp3'), artist: '', album: '', duration: 0, cover: null, lyrics: '' }
  }
})

// ── IPC: Last.fm (géneros y radio) ───────────────────────────────────────────
ipcMain.handle('lastfm-status',  () => ({ hasKey: lastfm.hasKey() }))
ipcMain.handle('lastfm-set-key', (_, key) => lastfm.setKey(key))
ipcMain.handle('lastfm-cached',  () => lastfm.cached())
ipcMain.handle('lastfm-tags',    (_, q) => lastfm.tags(q))
ipcMain.handle('lastfm-similar', (_, q) => lastfm.similar(q))

// ── IPC: análisis de audio (género por canción y "huella" para la radio) ─────
const AUDIO_PATH = path.join(app.getPath('userData'), 'audio-features.json')
let audioStore = null
let audioWorker = null
let audioSaveTimer = null

function loadAudio() {
  if (audioStore) return audioStore
  try { audioStore = JSON.parse(fs.readFileSync(AUDIO_PATH, 'utf8')) } catch {}
  if (!audioStore?.songs) audioStore = { version: 1, songs: {} }
  return audioStore
}
function saveAudio() {
  clearTimeout(audioSaveTimer)
  audioSaveTimer = null
  if (!audioStore) return
  try { fs.writeFileSync(AUDIO_PATH, JSON.stringify(audioStore)) }
  catch (e) { console.error('audio save error:', e.message) }
}
const toRenderer = (ch, data) => BrowserWindow.getAllWindows()[0]?.webContents.send(ch, data)

function startAudioWorker() {
  if (audioWorker) return audioWorker
  audioWorker = utilityProcess.fork(path.join(__dirname, 'audio-worker.js'), [], { serviceName: 'Análisis de audio' })
  audioWorker.on('message', msg => {
    if (msg.type === 'result' || msg.type === 'lyrics') {
      const songs = loadAudio().songs
      if (msg.type === 'result') songs[msg.path] = msg.data
      else if (songs[msg.path]) songs[msg.path].lyr = msg.lyr
      else return
      // A lo mucho un guardado cada 5 s mientras llegan resultados
      if (!audioSaveTimer) audioSaveTimer = setTimeout(saveAudio, 5000)
      toRenderer('audio-result', { path: msg.path, data: songs[msg.path] })
    } else {
      toRenderer('audio-progress', msg)
    }
  })
  audioWorker.on('exit', () => { audioWorker = null })
  return audioWorker
}

ipcMain.handle('audio-cached', () => loadAudio().songs)

// files = toda la biblioteca [{ path, mtime }]: se limpia lo borrado y se encola lo nuevo
ipcMain.handle('audio-analyze', (_, files) => {
  const store = loadAudio()
  const alive = new Set(files.map(f => f.path))
  for (const p of Object.keys(store.songs)) if (!alive.has(p)) delete store.songs[p]
  const todo = files.filter(f => store.songs[f.path]?.mtime !== f.mtime)
  // Analizadas antes de que existiera el ánimo por letra: sólo falta leer la letra
  const lyrics = files.filter(f => { const s = store.songs[f.path]; return s?.mtime === f.mtime && !s.error && s.lyr === undefined })
  if (todo.length || lyrics.length) startAudioWorker().postMessage({ type: 'analyze', items: todo, lyrics })
  return todo.length + lyrics.length
})

// ── IPC: Gemini (cerebro y voz del DJ) ───────────────────────────────────────
// Los errores viajan como { error } para que el renderer decida el respaldo
const wrap = fn => (_, ...a) => fn(...a).then(v => ({ ok: v }), e => ({ error: e.message }))
ipcMain.handle('gemini-status',  () => ({ hasKey: gemini.hasKey() }))
ipcMain.handle('gemini-set-key', (_, key) => gemini.setKey(key))
// engine: 'gemini' (Laomedeia, verificada antes de entregarla) o 'dalia' (Edge, sin límite)
ipcMain.handle('dj-say', wrap((text, engine) => engine === 'gemini' ? gemini.say(text) : voice.say(text)))
// En vivo: el audio llega al renderer por pedazos ('dj-chunk') para que Nat hable al instante
ipcMain.handle('dj-cached', (_, text) => gemini.cached(text))
ipcMain.handle('dj-clean', (_, keep) => gemini.cleanup(keep))

// ── IPC: video de fondo (tipo Canvas de Spotify) ─────────────────────────────
// Se busca en YouTube leyendo la página de resultados (sin key ni límite diario). Se prefiere
// el video oficial del artista (o su visualizer oficial, que es una animación en loop); letras,
// "audio" y visualizers de fans no.
// Se guarda por canción: cada una se busca una sola vez.
const YT_PATH = path.join(app.getPath('userData'), 'yt-cache.json')
let ytCache = null
const ytFold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()
async function ytSearch(q) {
  const res = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&hl=es', {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'es-MX,es;q=0.9' },
    signal: AbortSignal.timeout(10000),
  })
  const m = (await res.text()).match(/var ytInitialData = (\{.*?\});<\/script>/s)
  if (!m) return []
  const out = []
  const walk = o => {
    if (!o || typeof o !== 'object' || out.length >= 12) return
    if (o.videoRenderer?.videoId) {
      const v = o.videoRenderer
      out.push({ id: v.videoId, title: (v.title?.runs || []).map(r => r.text).join(''), channel: v.ownerText?.runs?.[0]?.text || '' })
      return
    }
    for (const k in o) walk(o[k])
  }
  walk(JSON.parse(m[1]))
  return out
}
ipcMain.handle('yt-videos', async (_, artist, title, live) => {
  const key = 'v2|' + ytFold(artist) + '|' + ytFold(title)   // v2: con visualizers oficiales
  if (!ytCache) { try { ytCache = JSON.parse(fs.readFileSync(YT_PATH, 'utf8')) } catch { ytCache = {} } }
  const c = ytCache[key]
  if (c && Date.now() - c.at < (c.ids.length ? 60 : 7) * 864e5) return c.ids
  let list
  try { list = await ytSearch(`${artist} ${title} video oficial`) } catch { return null }   // sin internet
  const t = ytFold(title), a = ytFold(artist).split(' ')[0]
  const scored = list.map(v => {
    const vt = ytFold(v.title), ch = ytFold(v.channel)
    if (!vt.includes(t.split(' ').slice(0, 3).join(' '))) return null            // otra canción
    if (/\b(letra|lyrics?|lyric video|audio|karaoke|cover|reaccion|reaction|8d|slowed|sped up|nightcore)\b/.test(vt)) return null
    if (!live && /\b(en vivo|live|concierto)\b/.test(vt)) return null
    const official = a && (ch.includes(a) || /vevo/.test(ch))
    if (/\bvisualizer\b/.test(vt) && !official) return null
    let score = 0
    if (/\b(video oficial|official video|official music video|videoclip|video clip)\b/.test(vt)) score += 3
    if (official) score += 2
    if (a && vt.includes(a)) score += 1
    return { id: v.id, score }
  }).filter(Boolean).sort((x, y) => y.score - x.score)
  const ids = scored.filter(x => x.score >= 2).slice(0, 3).map(x => x.id)
  ytCache[key] = { ids, at: Date.now() }
  try { fs.writeFileSync(YT_PATH, JSON.stringify(ytCache)) } catch {}
  return ids
})

// ── IPC: clima (Open-Meteo, gratis y sin key) para que DJ Nat lo comente ───────
// Ubicación: la ciudad que escribiste en Ajustes o, si no, la aproximada por tu IP.
// Se guarda la ubicación y el clima se consulta como mucho cada 30 min.
const WEATHER_PATH = path.join(app.getPath('userData'), 'weather.json')
let weatherCache = null
ipcMain.handle('weather', async (_, city) => {
  city = String(city || '').trim()
  try {
    const saved = weatherCache || (() => { try { return JSON.parse(fs.readFileSync(WEATHER_PATH, 'utf8')) } catch { return {} } })()
    if (saved.at && Date.now() - saved.at < 30 * 60 * 1000 && saved.query === city) return saved.data
    let loc = saved.query === city ? saved.loc : null
    if (!loc && city) {
      // "Cuautla, Morelos": se busca la ciudad y se prefiere la del estado que dijiste
      // (sólo "Morelos" da pueblos de Coahuila, Zacatecas… antes que el estado)
      const [name, region = ''] = city.split(',').map(x => x.trim())
      const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=10&language=es&name=${encodeURIComponent(name)}`,
        { signal: AbortSignal.timeout(10000) })).json()
      const fold = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const list = g.results || []
      const r = (region && list.find(x => fold(`${x.admin1} ${x.country}`).includes(fold(region)))) || list[0]
      if (r) loc = { lat: r.latitude, lon: r.longitude, name: r.name }
    }
    if (!loc) {
      const ip = await (await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(10000) })).json()
      if (ip.success && ip.latitude) loc = { lat: ip.latitude, lon: ip.longitude, name: ip.city }
    }
    if (!loc) return null
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      '&current=temperature_2m,apparent_temperature,weather_code&timezone=auto', { signal: AbortSignal.timeout(10000) })).json()
    const c = w.current
    if (!c) return null
    // Códigos WMO: llovizna 51-57, lluvia 61-67, chubascos 80-82, tormenta 95-99
    const rain = (c.weather_code >= 51 && c.weather_code <= 67) || (c.weather_code >= 80 && c.weather_code <= 82) || c.weather_code >= 95
    const feels = c.apparent_temperature ?? c.temperature_2m
    const data = { city: loc.name, temp: Math.round(c.temperature_2m),
                   kind: rain ? 'lluvia' : feels >= 30 ? 'calor' : feels <= 14 ? 'frio' : null }
    weatherCache = { at: Date.now(), query: city, loc, data }
    fs.writeFileSync(WEATHER_PATH, JSON.stringify(weatherCache))
    return data
  } catch {
    return null
  }
})
// Lo que le escribes a DJ Nat (y lo que te contesta), para después hacer frases con tu estilo
ipcMain.on('dj-chat-log', (_, who, text) => {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'dj-chat.log'),
      `${new Date().toLocaleString('es-MX')}\t${who}\t${String(text).replace(/\s+/g, ' ')}\n`)
  } catch {}
})
ipcMain.handle('dj-say-now', async (e, text, id) => {
  try {
    return { ok: await gemini.sayNow(text, buf => { if (!e.sender.isDestroyed()) e.sender.send('dj-chunk', id, buf.toString('base64')) }, id) }
  } catch (err) {
    return { error: err.message, partial: !!err.partial }
  }
})
ipcMain.on('dj-cancel', (_, id) => gemini.cancelNow(id))
ipcMain.handle('dj-think', wrap((system, prompt, schema, urgent) => gemini.think(system, prompt, schema, urgent)))

ipcMain.on('open-external', (_, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url)
})

// ── IPC: control de ventana ───────────────────────────────────────────────────
ipcMain.on('win-close',    () => BrowserWindow.getFocusedWindow()?.close())
ipcMain.on('win-minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('win-maximize', () => {
  const w = BrowserWindow.getFocusedWindow()
  w?.isMaximized() ? w.unmaximize() : w?.maximize()
})
