# Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer la app instantánea en bibliotecas de 5000+ canciones mediante caché JSON de metadata, virtual scroll y debounced search.

**Architecture:** El main process gestiona el caché en `userData/music-cache.json`. El renderer carga el caché al inicio (instantáneo), renderiza la lista con virtual scroll (solo ~20 nodos DOM), y solo lee con `music-metadata` los MP3 nuevos o modificados, en paralelo de 8 en 8.

**Tech Stack:** Electron (Node.js main process), fs.promises, Web Audio API, HTML/CSS/JS vanilla — sin dependencias nuevas.

---

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `main.js` | Constante `CACHE_PATH`, handlers `load-cache` y `save-cache`, `scan-music` retorna `{path, mtime}` |
| `preload.js` | Exponer `loadCache`, `saveCache` |
| `renderer.js` | Virtual scroll (reemplaza `renderList`, `scheduleListUpdate`), `scanLibrary` con caché, `loadAndPlay` con cover on-demand, debounce en `filterSongs` |
| `styles.css` | Altura fija 52px en `#song-list li` para O(1) en virtual scroll |

---

## Task 1: IPC — handlers de caché en main.js y preload.js

**Files:**
- Modify: `main.js` — agregar después de la línea `ipcMain.handle('get-music-dir', ...)`
- Modify: `preload.js` — agregar `loadCache` y `saveCache`

- [ ] **Step 1: Agregar `CACHE_PATH` y handlers en main.js**

Agregar la constante `CACHE_PATH` en `main.js` justo después de la línea 5 (`const MUSIC_DIR = app.getPath('music')`):

```js
const CACHE_PATH = path.join(app.getPath('userData'), 'music-cache.json')
```

Luego agregar los dos handlers después de `ipcMain.handle('get-music-dir', () => MUSIC_DIR)` (línea 62):

```js
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
```

- [ ] **Step 2: Exponer `loadCache` y `saveCache` en preload.js**

Reemplazar el contenido completo de `preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getMusicDir:      ()        => ipcRenderer.invoke('get-music-dir'),
  loadCache:        ()        => ipcRenderer.invoke('load-cache'),
  saveCache:        (cache)   => ipcRenderer.invoke('save-cache', cache),
  scanMusic:        ()        => ipcRenderer.invoke('scan-music'),
  readMeta:         (path)    => ipcRenderer.invoke('read-meta', path),
  winClose:         ()        => ipcRenderer.send('win-close'),
  winMinimize:      ()        => ipcRenderer.send('win-minimize'),
  winMaximize:      ()        => ipcRenderer.send('win-maximize'),
  onLibraryChanged: (cb)      => ipcRenderer.on('library-changed', cb),
})
```

- [ ] **Step 3: Verificar que la app sigue funcionando**

Ejecutar `npm start` en `C:\Users\HUAWEI\Music\Project\MusicPlayerElectron`. La app debe abrir y cargar canciones normalmente. Los nuevos handlers existen pero aún no se usan.

- [ ] **Step 4: Commit**

```bash
git add main.js preload.js
git commit -m "feat: add load-cache and save-cache IPC handlers"
```

---

## Task 2: Virtual scroll — CSS

**Files:**
- Modify: `styles.css` — línea 130 (regla de `#song-list li`)

- [ ] **Step 1: Fijar altura de `#song-list li`**

En `styles.css`, reemplazar la línea actual de `#song-list li` (línea 130):

```css
/* ANTES: */
#song-list li { padding: 5px 10px; cursor: pointer; transition: background .1s; display: flex; align-items: center; gap: 8px; }

/* DESPUÉS: */
#song-list li { height: 52px; padding: 0 10px; cursor: pointer; transition: background .1s; display: flex; align-items: center; gap: 8px; box-sizing: border-box; }
```

La altura fija de 52px permite calcular índices en O(1): `startIndex = Math.floor(scrollTop / 52)`. Sin `box-sizing: border-box` el padding podría exceder los 52px.

- [ ] **Step 2: Verificar visualmente**

Ejecutar `npm start`. La lista de canciones debe verse exactamente igual que antes (los ítems tienen thumbnail de 36px centrado verticalmente en 52px — correcto).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: set fixed 52px row height on song list for virtual scroll"
```

---

## Task 3: Virtual scroll — renderer.js

**Files:**
- Modify: `renderer.js` — reemplazar `renderList()`, `scheduleListUpdate()`, y el bloque de `querySelectorAll` en `loadAndPlay()`

**Contexto importante:** El virtual scroll mantiene solo ~20 `<li>` en el DOM. Dos `<div>` spacer empujan el contenido y mantienen la scrollbar proporcional. `renderList()` es ahora la función central de render — barata de llamar (~20 nodos).

- [ ] **Step 1: Reemplazar `scheduleListUpdate` y `renderList` en renderer.js**

Ubicar el bloque que empieza con `const pendingUpdates = new Set()` (línea 219) y reemplazarlo completo hasta el final de `renderList()` (línea 306), incluyendo `updateListItem` (línea 308):

```js
// ── Virtual Scroll ────────────────────────────────────────────────────────────
const ROW_HEIGHT = 52
const OVERSCAN   = 3

const vsList       = document.getElementById('song-list')
const vsSpacerTop  = document.createElement('div')
const vsSpacerBot  = document.createElement('div')
vsList.appendChild(vsSpacerTop)
vsList.appendChild(vsSpacerBot)

let vsStart  = 0
let vsEnd    = 0
let vsRafId  = null

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

let vsUpdatePending = false
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
```

- [ ] **Step 2: Actualizar `loadAndPlay` — reemplazar el `querySelectorAll` por virtual scroll**

En `loadAndPlay()`, reemplazar estas líneas (después de `const song = currentSong`):

```js
// ANTES:
document.querySelectorAll('#song-list li').forEach((li, i) =>
  li.classList.toggle('active', filtered[i] === currentSong))

// DESPUÉS:
renderList()
vsScrollToIndex(idx)
```

- [ ] **Step 3: Verificar**

Ejecutar `npm start`. La lista debe verse igual y scrollear fluidamente. Hacer click en una canción — debe resaltarse y el audio debe reproducirse. Verificar con lista larga que el scroll no se traba.

- [ ] **Step 4: Commit**

```bash
git add renderer.js
git commit -m "feat: replace renderList with virtual scroll — O(1) DOM for any library size"
```

---

## Task 4: Cache-aware scanLibrary + scan-music retorna {path, mtime}

**Files:**
- Modify: `main.js` — actualizar handler `scan-music` para retornar `{path, mtime}`
- Modify: `renderer.js` — reemplazar `scanLibrary()` y agregar cover on-demand en `loadAndPlay()`

**Contexto:** `scan-music` ahora retorna `[{path, mtime}]`. El renderer compara `mtime` con el caché y solo llama `readMeta` para archivos nuevos/modificados. Para archivos cacheados la lista aparece instantáneamente. Al reproducir una canción sin cover en memoria se carga on-demand.

- [ ] **Step 1: Actualizar `scan-music` en main.js para incluir mtime**

Reemplazar el handler `scan-music` completo (líneas 65–81):

```js
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
```

- [ ] **Step 2: Reemplazar `scanLibrary()` en renderer.js**

Reemplazar la función `scanLibrary` completa (líneas 241–270):

```js
async function scanLibrary() {
  setLibCount('Cargando…')

  const [cache, files] = await Promise.all([api.loadCache(), api.scanMusic()])
  // cache  = { version: 1, songs: { path → { title, artist, album, duration, mtime } } }
  // files  = [{ path, mtime }]

  const prevMap  = new Map(allSongs.map(s => [s.path, s]))
  const pathSet  = new Set(files.map(f => f.path))

  // Limpiar entradas eliminadas del caché
  for (const p of Object.keys(cache.songs)) {
    if (!pathSet.has(p)) delete cache.songs[p]
  }

  // Construir allSongs desde caché (instantáneo)
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

  // Solo leer MP3s nuevos o modificados, en paralelo de 8
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
        Object.assign(song, meta, { mtime })
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
```

- [ ] **Step 3: Agregar `metaLoaded` flag y cover on-demand en `loadAndPlay()`**

Las canciones cacheadas comienzan con `cover: null` y `lyrics: ''`. Sin un flag explícito, la app llamaría `readMeta` infinitamente para canciones sin portada ni letra. El flag `metaLoaded` evita esto.

En `scanLibrary()`, en el `Object.assign` dentro del `Promise.all` del batch, agregar `metaLoaded: true`:

```js
// ANTES:
Object.assign(song, meta, { mtime })

// DESPUÉS:
Object.assign(song, meta, { mtime, metaLoaded: true })
```

En `loadAndPlay()`, reemplazar las dos líneas `setCover(song.cover)` y `buildLyrics(song.lyrics)` con:

```js
// ANTES:
setCover(song.cover)
buildLyrics(song.lyrics)

// DESPUÉS:
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
```

`song.metaLoaded` es `true` solo después de que `readMeta` fue llamado (en batch o on-demand). Las canciones cacheadas arrancan sin este flag — al reproducirse lo cargan la primera vez, y ya no vuelven a hacerlo.

- [ ] **Step 4: Verificar**

Ejecutar `npm start`. Primera vez: la lista aparece con títulos del nombre de archivo, luego se actualizan conforme se leen los MP3 (en batches de 8). Segunda vez: la lista debe aparecer completa e instantáneamente con títulos/artistas correctos. Al reproducir una canción el cover debe aparecer (quizás con un breve delay en primera reproducción).

Verificar que `userData/music-cache.json` existe después de la primera carga:
```
# Windows PowerShell
Test-Path "$env:APPDATA\music-player\music-cache.json"
```

- [ ] **Step 5: Commit**

```bash
git add main.js renderer.js
git commit -m "feat: metadata cache and parallel batch loading for instant startup"
```

---

## Task 5: Debounced search

**Files:**
- Modify: `renderer.js` — función `filterSongs()` (línea ~317)

- [ ] **Step 1: Agregar debounce a `filterSongs()`**

Agregar la variable `searchTimer` justo antes de `filterSongs()`:

```js
let searchTimer = null
```

Reemplazar la función `filterSongs()` completa:

```js
// ANTES:
function filterSongs() {
  applyFilter()
  document.getElementById('filter-bar').style.display = 'none'
  renderList()
}

// DESPUÉS:
function filterSongs() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    applyFilter()
    document.getElementById('filter-bar').style.display = 'none'
    vsList.scrollTop = 0
    renderList()
  }, 300)
}
```

`vsList.scrollTop = 0` resetea al top cuando se busca, para que los primeros resultados sean visibles.

- [ ] **Step 2: Verificar**

Ejecutar `npm start`. Escribir rápidamente en el buscador — la lista no debe re-renderizarse en cada tecla sino 300ms después de dejar de escribir.

- [ ] **Step 3: Commit**

```bash
git add renderer.js
git commit -m "perf: debounce search input to avoid re-render on every keystroke"
```

---

## Verificación final

Después de los 5 tasks:

- [ ] Primera ejecución: la lista carga en ~30 segundos (5000 canciones a 8 en paralelo)
- [ ] Segunda ejecución: la lista aparece en < 1 segundo
- [ ] Scroll con 5000+ canciones es fluido (60fps en 60Hz, 120fps en 120Hz)
- [ ] Buscar "rock" rápidamente solo dispara un re-render (300ms después de la última tecla)
- [ ] Reproducir una canción cacheada: cover aparece (puede tener ~200ms de delay)
- [ ] `music-cache.json` en `%APPDATA%\music-player\` pesa < 5MB
- [ ] Agregar un nuevo MP3 y reiniciar: solo ese archivo nuevo se re-lee, el resto carga del caché
