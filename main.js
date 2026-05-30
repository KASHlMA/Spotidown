const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs   = require('fs')

const MUSIC_DIR = app.getPath('music')
const CACHE_PATH = path.join(app.getPath('userData'), 'music-cache.json')

function createWindow() {
  const win = new BrowserWindow({
    width: 1080, height: 700,
    minWidth: 720, minHeight: 520,
    frame: false,
    backgroundColor: '#0A0A0A',
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
        if (entry.isDirectory()) await walk(full)
        else if (entry.name.toLowerCase().endsWith('.mp3')) results.push(full)
      }
    } catch (e) { console.error('scan-music walk error:', d, e.message) }
  }
  await walk(MUSIC_DIR)
  results.sort()
  return results
})

// ── IPC: leer metadata de un MP3 ─────────────────────────────────────────────
ipcMain.handle('read-meta', async (_, filePath) => {
  try {
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(filePath, { duration: true, skipCovers: false })
    const tag  = meta.common

    let coverBase64 = null
    if (tag.picture && tag.picture.length > 0) {
      const pic = tag.picture[0]
      coverBase64 = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`
    }

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
          lyrics = uslt.value?.text || uslt.value || ''
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
      lyrics,
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
