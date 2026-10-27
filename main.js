const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron')
const path = require('path')
const fs   = require('fs')

const MUSIC_DIR = app.getPath('music')
const CACHE_PATH = path.join(app.getPath('userData'), 'music-cache.json')

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
function watchMusicDir() {
  let debounce = null
  try {
    fs.watch(MUSIC_DIR, { recursive: true }, (_, filename) => {
      if (!filename?.toLowerCase().endsWith('.mp3')) return
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) win.webContents.send('library-changed')
      }, 3000)
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

// ── IPC: control de ventana ───────────────────────────────────────────────────
ipcMain.on('win-close',    () => BrowserWindow.getFocusedWindow()?.close())
ipcMain.on('win-minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('win-maximize', () => {
  const w = BrowserWindow.getFocusedWindow()
  w?.isMaximized() ? w.unmaximize() : w?.maximize()
})
