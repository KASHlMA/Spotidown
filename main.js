const { app, BrowserWindow, ipcMain, shell, nativeImage, utilityProcess } = require('electron')
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
}

app.whenReady().then(() => {
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
ipcMain.handle('dj-say', wrap((text, engine, fast) => engine === 'gemini' ? gemini.say(text, fast) : voice.say(text)))
ipcMain.handle('dj-cached', (_, text) => gemini.cached(text))
ipcMain.handle('dj-think', wrap((system, prompt, schema) => gemini.think(system, prompt, schema)))

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
