# Spotify-style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la UI del reproductor para replicar el layout y estilo visual de Spotify — sidebar izquierda, home con recientes/artistas/álbumes, barra de controles fija abajo, y vista de letra en el centro.

**Architecture:** Reescritura de `index.html` y `styles.css`. Cambios quirúrgicos en `renderer.js`: actualizar IDs de elementos DOM, eliminar colores dinámicos, agregar sistema de vistas, y construir la vista Home. `main.js` y `preload.js` no cambian.

**Tech Stack:** Electron, HTML/CSS vanilla, JS vanilla — sin dependencias nuevas.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `index.html` | Reescritura total |
| `styles.css` | Reescritura total |
| `renderer.js` | Cambios quirúrgicos en ~8 secciones |

**Orden de ejecución obligatorio:** Task 1 (HTML) → Task 2 (CSS) → Tasks 3-6 (JS). Las Tasks 1 y 2 deben hacerse juntas antes de cualquier JS porque el HTML nuevo rompe el JS actual.

---

## Task 1: Reescribir index.html

**Files:**
- Rewrite: `index.html`

El HTML nuevo reemplaza el layout de 3 columnas por: sidebar izquierda + área central + barra de player fija abajo. IDs críticos que el JS actual ya usa y se mantienen igual: `btn-min`, `btn-max`, `btn-close`, `btn-play`, `btn-prev`, `btn-next`, `btn-shuffle`, `btn-repeat`, `btn-queue`, `btn-queue-close`, `icon-play`, `seek-track`, `seek-fill`, `seek-thumb`, `vol-track`, `vol-fill`, `vol-thumb`, `t-cur`, `t-tot`, `audio`, `lyrics-scroll`, `lyrics-inner`, `song-list`, `lib-count`, `filter-bar`, `filter-label`, `filter-clear`, `search`, `queue-panel`, `queue-list`, `queue-meta`, `spectrum`.

IDs nuevos: `view-home`, `view-library`, `view-lyrics`, `bar-song-title`, `bar-song-artist`, `bar-cover-img`, `bar-no-cover`, `cover-img`, `no-cover`, `song-title-lyrics`, `song-artist-lyrics`, `song-album-lyrics`, `btn-lyrics`, `recents-list`, `recents-grid`, `home-greeting`, `home-artists`, `home-albums`.

IDs eliminados (ya no existen): `view-songs`, `view-artists`, `view-folders`, `song-title`, `song-artist`, `bg-blur`, `art-glow`, `art-circle`, `cover-img` (vieja ubicación), `search-artists`, `search-folders`.

- [ ] **Step 1: Reemplazar index.html con el contenido completo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Music Player</title>
  <link rel="stylesheet" href="styles.css"/>
</head>
<body>

  <div class="titlebar">
    <span class="app-name">♫ Music</span>
    <div class="win-btns">
      <button id="btn-min">&#8211;</button>
      <button id="btn-max">&#9633;</button>
      <button id="btn-close" class="close">&#10005;</button>
    </div>
  </div>

  <div class="app-layout">

    <nav class="sidebar">
      <div class="nav-main">
        <button class="nav-btn active" data-view="home">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Inicio</span>
        </button>
        <button class="nav-btn" data-view="library">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
          <span>Biblioteca</span>
        </button>
      </div>
      <div class="nav-section">
        <span class="nav-section-label">RECIENTES</span>
        <ul id="recents-list"></ul>
      </div>
    </nav>

    <main class="center">

      <div id="view-home" class="view">
        <div class="home-scroll">
          <h1 id="home-greeting">Buenas tardes</h1>
          <div class="home-section" id="recents-section">
            <h2 class="section-title">Escuchado recientemente</h2>
            <div id="recents-grid" class="recents-grid"></div>
          </div>
          <div class="home-section" id="artists-section">
            <h2 class="section-title">Tus artistas</h2>
            <div id="home-artists" class="home-row"></div>
          </div>
          <div class="home-section" id="albums-section">
            <h2 class="section-title">Tus álbumes</h2>
            <div id="home-albums" class="home-row"></div>
          </div>
        </div>
      </div>

      <div id="view-library" class="view" style="display:none">
        <div class="library-top">
          <div class="search-wrap">
            <input id="search" type="text" placeholder="Buscar en tu biblioteca…"/>
          </div>
          <div id="filter-bar" style="display:none">
            <span id="filter-label"></span>
            <button id="filter-clear">✕</button>
          </div>
        </div>
        <ul id="song-list"></ul>
        <p class="lib-count" id="lib-count"></p>
      </div>

      <div id="view-lyrics" class="view" style="display:none">
        <div class="lyrics-area">
          <div class="lyrics-scroll" id="lyrics-scroll">
            <div class="lyrics-inner" id="lyrics-inner"></div>
          </div>
        </div>
        <div class="lyrics-nowplaying">
          <div class="lnp-cover">
            <img id="cover-img" alt="" style="display:none"/>
            <span class="no-cover" id="no-cover">
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
            </span>
          </div>
          <div id="song-title-lyrics" class="lnp-title">Sin canción</div>
          <div id="song-artist-lyrics" class="lnp-artist"></div>
          <div id="song-album-lyrics" class="lnp-album"></div>
          <canvas id="spectrum" class="spectrum"></canvas>
        </div>
      </div>

    </main>
  </div>

  <footer class="player-bar">
    <div class="bar-left">
      <div class="bar-thumb">
        <img id="bar-cover-img" alt="" style="display:none"/>
        <span id="bar-no-cover">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
        </span>
      </div>
      <div class="bar-info">
        <div class="bar-title" id="bar-song-title">Sin canción seleccionada</div>
        <div class="bar-artist" id="bar-song-artist"></div>
      </div>
    </div>

    <div class="bar-center">
      <div class="bar-controls">
        <button id="btn-shuffle" class="bar-btn" title="Aleatorio">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
        </button>
        <button id="btn-prev" class="bar-btn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 6h2v12H6zm3.5 6L20 6v12z"/></svg>
        </button>
        <button id="btn-play" class="bar-btn bar-play-btn">
          <svg id="icon-play" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button id="btn-next" class="bar-btn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
        <button id="btn-repeat" class="bar-btn" title="Repetir">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
        </button>
      </div>
      <div class="bar-seek">
        <span id="t-cur">0:00</span>
        <div class="slider-track" id="seek-track">
          <div class="slider-fill" id="seek-fill"></div>
          <div class="slider-thumb" id="seek-thumb"></div>
        </div>
        <span id="t-tot">0:00</span>
      </div>
    </div>

    <div class="bar-right">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5zm11-.5v9a6.5 6.5 0 0 0 0-9z"/></svg>
      <div class="slider-track" id="vol-track">
        <div class="slider-fill" id="vol-fill"></div>
        <div class="slider-thumb" id="vol-thumb"></div>
      </div>
      <button id="btn-queue" class="bar-btn" title="Cola">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
      </button>
      <button id="btn-lyrics" class="bar-btn" title="Letra">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 3v11.5a3.5 3.5 0 0 1-7 0v-1.5h2v1.5a1.5 1.5 0 1 0 3 0V3h2zm6 0h6v2h-6V3zm0 4h6v2h-6V7zm0 4h4v2h-4v-2z"/></svg>
      </button>
    </div>
  </footer>

  <div id="queue-panel">
    <div class="queue-header">
      <span class="queue-title">Cola de reproducción</span>
      <span class="queue-meta" id="queue-meta"></span>
      <button id="btn-queue-close">✕</button>
    </div>
    <ul id="queue-list"></ul>
  </div>

  <audio id="audio"></audio>
  <script src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verificar que index.html tenga todos los IDs críticos**

Abrir el archivo y confirmar que existen: `btn-play`, `seek-track`, `vol-track`, `song-list`, `spectrum`, `lyrics-inner`, `queue-panel`, `audio`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: new Spotify-style HTML structure"
```

---

## Task 2: Reescribir styles.css

**Files:**
- Rewrite: `styles.css`

- [ ] **Step 1: Reemplazar styles.css con el contenido completo**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:      #121212;
  --sidebar: #000000;
  --bar:     #181818;
  --card:    #282828;
  --hover:   #333333;
  --green:   #1DB954;
  --white:   #FFFFFF;
  --t2:      #B3B3B3;
  --t3:      #6a6a6a;
  --border:  #282828;
  --prog:    #535353;
}

html, body {
  height: 100%; overflow: hidden;
  background: var(--bg); color: var(--white);
  font-family: 'Circular Std', system-ui, -apple-system, sans-serif;
  user-select: none;
}

/* ── Titlebar ── */
.titlebar {
  height: 36px; display: flex; align-items: center;
  justify-content: space-between; padding: 0 12px;
  background: var(--sidebar); -webkit-app-region: drag;
  position: relative; z-index: 200;
}
.app-name { font-size: 13px; font-weight: 700; color: var(--green); }
.win-btns { display: flex; gap: 2px; -webkit-app-region: no-drag; }
.win-btns button {
  background: none; border: none; color: var(--t3); cursor: pointer;
  width: 32px; height: 26px; border-radius: 4px; font-size: 13px;
  transition: color .15s, background .15s;
}
.win-btns button:hover { background: #1a1a1a; color: var(--t2); }
.win-btns .close:hover { background: #c0392b; color: #fff; }

/* ── Layout ── */
.app-layout {
  display: grid;
  grid-template-columns: 140px 1fr;
  height: calc(100vh - 36px - 72px);
}

/* ── Sidebar ── */
.sidebar {
  background: var(--sidebar); display: flex; flex-direction: column;
  overflow: hidden; border-right: 1px solid #1a1a1a;
}
.nav-main { padding: 10px 8px 6px; flex-shrink: 0; }
.nav-btn {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: none; border: none; color: var(--t3);
  font-family: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; padding: 8px 10px; border-radius: 6px;
  transition: color .15s; text-align: left; margin-bottom: 2px;
}
.nav-btn:hover { color: var(--white); }
.nav-btn.active { color: var(--white); }
.nav-btn svg { flex-shrink: 0; }

.nav-section {
  flex: 1; overflow: hidden; display: flex; flex-direction: column;
  padding: 0 8px; min-height: 0;
}
.nav-section-label {
  font-size: 9px; font-weight: 700; color: var(--t3);
  letter-spacing: 1px; padding: 10px 10px 6px; flex-shrink: 0;
}
#recents-list {
  list-style: none; overflow-y: auto; flex: 1;
  scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;
}
#recents-list li {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; border-radius: 4px; cursor: pointer;
  transition: background .1s;
}
#recents-list li:hover { background: #1a1a1a; }
.rl-thumb {
  width: 28px; height: 28px; border-radius: 3px;
  background: var(--card); flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.rl-thumb img { width: 100%; height: 100%; object-fit: cover; }
.rl-thumb svg { color: #444; }
.rl-name {
  font-size: 10px; color: var(--t2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Center ── */
.center { background: var(--bg); display: flex; flex-direction: column; overflow: hidden; }
.view { display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 0; }

/* ── Home view ── */
.home-scroll {
  flex: 1; overflow-y: auto; padding: 24px 28px 20px;
  scrollbar-width: thin; scrollbar-color: #333 transparent;
}
#home-greeting { font-size: 26px; font-weight: 700; color: var(--white); margin-bottom: 24px; }
.home-section { margin-bottom: 32px; }
.section-title { font-size: 17px; font-weight: 700; color: var(--white); margin-bottom: 14px; }

.recents-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.recent-card {
  display: flex; align-items: center; background: var(--card);
  border-radius: 4px; overflow: hidden; cursor: pointer;
  height: 52px; transition: background .15s;
}
.recent-card:hover { background: var(--hover); }
.recent-card-img { width: 52px; height: 52px; object-fit: cover; flex-shrink: 0; }
.recent-card-nothumb {
  width: 52px; height: 52px; background: #333; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.recent-card-nothumb svg { color: #555; }
.recent-card-name {
  font-size: 11px; font-weight: 600; color: var(--white);
  padding: 0 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.home-row {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: none;
}
.home-row::-webkit-scrollbar { display: none; }

.artist-hcard {
  flex-shrink: 0; width: 130px; text-align: center;
  cursor: pointer; padding: 12px 8px; border-radius: 8px;
  transition: background .15s;
}
.artist-hcard:hover { background: var(--card); }
.artist-hcard-avatar {
  width: 100px; height: 100px; border-radius: 50%;
  background: var(--card); overflow: hidden;
  margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;
}
.artist-hcard-avatar img { width: 100%; height: 100%; object-fit: cover; }
.artist-hcard-avatar svg { color: #555; }
.artist-hcard-name {
  font-size: 12px; font-weight: 600; color: var(--white);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.artist-hcard-sub { font-size: 11px; color: var(--t2); margin-top: 3px; }

.album-hcard {
  flex-shrink: 0; width: 140px; cursor: pointer;
  padding: 12px 8px 8px; border-radius: 8px; transition: background .15s;
}
.album-hcard:hover { background: var(--card); }
.album-hcard-thumb {
  width: 124px; height: 124px; border-radius: 4px;
  background: var(--card); overflow: hidden; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: center;
}
.album-hcard-thumb img { width: 100%; height: 100%; object-fit: cover; }
.album-hcard-thumb svg { color: #555; }
.album-hcard-name {
  font-size: 12px; font-weight: 600; color: var(--white);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.album-hcard-sub { font-size: 11px; color: var(--t2); margin-top: 3px; }

/* ── Library view ── */
.library-top { flex-shrink: 0; }
.library-top .search-wrap { padding: 12px 16px 8px; }
.search-wrap input {
  width: 100%; background: var(--card); border: 1px solid #3a3a3a;
  border-radius: 20px; padding: 8px 16px; color: var(--white);
  font-size: 13px; font-family: inherit; outline: none; transition: border-color .2s;
}
.search-wrap input:focus { border-color: var(--white); }
.search-wrap input::placeholder { color: var(--t3); }

#filter-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 16px 8px;
}
#filter-label {
  font-size: 12px; color: var(--green); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;
}
#filter-clear {
  background: none; border: none; color: var(--t3); cursor: pointer;
  font-size: 12px; padding: 2px 6px; border-radius: 4px; transition: color .15s;
}
#filter-clear:hover { color: var(--white); }

#song-list {
  list-style: none; overflow-y: auto; flex: 1;
  scrollbar-width: thin; scrollbar-color: #333 transparent;
  contain: strict; will-change: transform;
}
#song-list li {
  height: 52px; padding: 0 16px; cursor: pointer; transition: background .1s;
  display: flex; align-items: center; gap: 12px; box-sizing: border-box;
}
#song-list li:hover { background: #1a1a1a; }
#song-list li.active { background: #1a1a1a; }
#song-list li.active .li-title { color: var(--green); }
.li-thumb {
  width: 40px; height: 40px; border-radius: 4px; flex-shrink: 0;
  background: var(--card); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.li-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.li-thumb img:not([src]) { display: none; }
.li-text { overflow: hidden; flex: 1; }
.li-title {
  font-size: 13px; color: var(--white);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.li-artist {
  font-size: 11px; color: var(--t2); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lib-count { font-size: 10px; color: var(--t3); text-align: center; padding: 8px 0; flex-shrink: 0; }

/* ── Lyrics view ── */
#view-lyrics { flex-direction: row !important; }
.lyrics-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.lyrics-scroll { flex: 1; overflow-y: auto; scrollbar-width: none; }
.lyrics-scroll::-webkit-scrollbar { display: none; }
.lyrics-inner { padding: 0 40px 80px; text-align: center; }

.lyric-line {
  font-size: 22px; color: #3a3a3a; padding: 10px 0;
  transition: color .25s, opacity .25s, transform .25s;
  will-change: transform, opacity, color;
  line-height: 1.5; cursor: pointer;
  transform: scale(0.82); transform-origin: center; opacity: 0.45;
}
.lyric-line:hover { color: var(--t2); }
.lyric-line.cur {
  color: var(--white); font-size: 48px; font-weight: 800;
  line-height: 1.2; transform: scale(1); opacity: 1;
  border-radius: 12px; padding: 6px 0;
}
.lyric-line.near1 {
  color: var(--t2); font-size: 30px; font-weight: 600;
  transform: scale(0.93); opacity: 0.75;
}
.lyric-line.near2 { color: var(--t3); font-size: 25px; transform: scale(0.87); opacity: 0.6; }
.lyric-line.plain { color: var(--t2); font-size: 20px; cursor: default; transform: scale(1); opacity: 1; }
.no-lyrics { color: var(--t3); font-size: 14px; margin-top: 60px; }

.lyrics-nowplaying {
  width: 220px; flex-shrink: 0; padding: 24px 16px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: var(--bg); border-left: 1px solid #1a1a1a;
  overflow-y: auto; scrollbar-width: none;
}
.lyrics-nowplaying::-webkit-scrollbar { display: none; }
.lnp-cover {
  width: 160px; height: 160px; border-radius: 8px;
  background: var(--card); overflow: hidden; margin-bottom: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.lnp-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.no-cover { color: #444; display: flex; }
.lnp-title {
  font-size: 14px; font-weight: 700; color: var(--white);
  text-align: center; width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lnp-artist {
  font-size: 12px; color: var(--t2); text-align: center; width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lnp-album {
  font-size: 11px; color: var(--t3); text-align: center; width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.spectrum { width: 100%; height: 60px; border-radius: 4px; margin-top: 8px; }

/* ── Player bar ── */
.player-bar {
  position: relative; z-index: 100;
  height: 72px; background: var(--bar); border-top: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 16px;
}
.bar-left {
  display: flex; align-items: center; gap: 12px;
  width: 220px; flex-shrink: 0;
}
.bar-thumb {
  width: 48px; height: 48px; border-radius: 4px;
  background: var(--card); flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.bar-thumb img { width: 100%; height: 100%; object-fit: cover; }
.bar-thumb svg { color: #444; }
.bar-info { overflow: hidden; min-width: 0; }
.bar-title {
  font-size: 13px; font-weight: 600; color: var(--white);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bar-artist {
  font-size: 11px; color: var(--t2); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.bar-center {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; gap: 6px; padding: 0 16px;
}
.bar-controls { display: flex; align-items: center; gap: 8px; }
.bar-seek { display: flex; align-items: center; gap: 8px; width: 100%; }
.bar-seek > span { font-size: 11px; color: var(--t3); min-width: 32px; }
.bar-seek > span:last-child { text-align: right; }

.bar-btn {
  background: none; border: none; color: var(--t2); cursor: pointer;
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color .15s, transform .1s; flex-shrink: 0;
}
.bar-btn:hover { color: var(--white); transform: scale(1.06); }
.bar-btn.active { color: var(--green); }
.bar-play-btn {
  width: 40px; height: 40px;
  background: var(--white); border-radius: 50%;
}
.bar-play-btn:hover { background: #e0e0e0; transform: scale(1.08); }
.bar-play-btn svg { color: #000; }

.bar-right {
  display: flex; align-items: center; gap: 8px;
  width: 180px; flex-shrink: 0; justify-content: flex-end;
}
.bar-right > svg { color: var(--t3); flex-shrink: 0; }
#vol-track { width: 80px; flex: none; }

/* ── Sliders ── */
.slider-track {
  flex: 1; height: 20px; position: relative;
  display: flex; align-items: center; cursor: pointer;
}
.slider-track::before {
  content: ''; position: absolute; left: 0; right: 0;
  height: 4px; background: var(--prog); border-radius: 2px;
}
.slider-fill {
  position: absolute; left: 0; height: 4px;
  background: var(--green); border-radius: 2px;
  pointer-events: none; width: 0%;
}
.slider-thumb {
  position: absolute; width: 12px; height: 12px;
  background: var(--white); border-radius: 50%;
  transform: translateX(-50%); left: 0%;
  opacity: 0; transition: opacity .15s; pointer-events: none;
}
.slider-track:hover .slider-thumb,
.slider-track:active .slider-thumb { opacity: 1; }

/* ── Queue panel ── */
#queue-panel {
  display: none; position: fixed;
  top: 36px; right: 0; bottom: 72px; width: 300px;
  z-index: 100; background: #121212;
  flex-direction: column; border-left: 1px solid var(--border);
}
#queue-panel.open { display: flex; }
.queue-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.queue-title { font-size: 13px; color: var(--white); font-weight: 700; flex: 1; }
.queue-meta  { font-size: 10px; color: var(--t3); }
#btn-queue-close {
  background: none; border: none; color: var(--t3);
  cursor: pointer; font-size: 14px; padding: 2px 4px;
  border-radius: 4px; transition: color .15s;
}
#btn-queue-close:hover { color: var(--white); }

#queue-list {
  list-style: none; overflow-y: auto; flex: 1;
  scrollbar-width: thin; scrollbar-color: #333 transparent; padding: 6px 0;
}
#queue-list li {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 16px; cursor: pointer; transition: background .1s;
}
#queue-list li:hover { background: #1a1a1a; }
#queue-list li.q-current { background: #1a1a1a; }
#queue-list li.q-current .q-title { color: var(--green); }
#queue-list li.q-past .q-title,
#queue-list li.q-past .q-artist { opacity: .35; }
.q-num { font-size: 10px; color: var(--t3); min-width: 18px; text-align: right; flex-shrink: 0; }
.q-current .q-num { color: var(--green); }
.q-thumb {
  width: 34px; height: 34px; border-radius: 4px; background: var(--card);
  overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.q-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.q-thumb img:not([src]) { display: none; }
.q-info { overflow: hidden; flex: 1; }
.q-title  { font-size: 12px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-artist { font-size: 10px; color: var(--t3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-badge { font-size: 9px; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }
.q-badge.now  { background: rgba(29,185,84,.2); color: var(--green); }
.q-badge.next { background: rgba(255,255,255,.07); color: var(--t2); }
```

- [ ] **Step 2: Verificar**

Ejecutar `npm start`. La app debe abrirse con el nuevo layout visual (sidebar verde, barra abajo) aunque las interacciones aún no funcionen completamente.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: new Spotify-style CSS with green palette"
```

---

## Task 3: Actualizar renderer.js — IDs DOM + eliminar colores dinámicos

**Files:**
- Modify: `renderer.js`

Este task hace 5 cambios quirúrgicos:
1. Elimina `spectrumColors` y actualiza `drawSpectrum` a color fijo
2. Reemplaza `setCover` para usar los nuevos IDs duales
3. Actualiza `loadAndPlay` para los nuevos IDs de título/artista
4. Elimina las funciones `extractColor`, `applyAccent`, `resetAccent`
5. Actualiza los listeners de búsqueda y filtro

- [ ] **Step 1: Eliminar `spectrumColors` y actualizar `drawSpectrum`**

En la sección de State (cerca de línea 21), eliminar esta línea:
```js
let spectrumColors = { dark: '#3D2A10', mid: '#C8A97E', light: '#FFE0AA' }
```

En `drawSpectrum`, encontrar el bloque del gradiente y reemplazarlo:
```js
// ANTES:
  const grad = ctx2d.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0,    spectrumColors.dark)
  grad.addColorStop(0.45, spectrumColors.mid)
  grad.addColorStop(1,    spectrumColors.light)
  ctx2d.fillStyle = grad

// DESPUÉS:
  ctx2d.fillStyle = '#1DB954'
```

- [ ] **Step 2: Reemplazar `setCover` completa**

Encontrar la función `setCover` (buscar `function setCover`) y reemplazarla con:

```js
function setCover(dataUrl) {
  const img    = document.getElementById('cover-img')
  const barImg = document.getElementById('bar-cover-img')
  const noIcon = document.getElementById('no-cover')
  const barNo  = document.getElementById('bar-no-cover')

  if (dataUrl) {
    img.src = dataUrl; img.style.display = 'block'
    barImg.src = dataUrl; barImg.style.display = 'block'
    noIcon.style.display = 'none'
    barNo.style.display  = 'none'
  } else {
    img.src = ''; img.style.display = 'none'
    barImg.src = ''; barImg.style.display = 'none'
    noIcon.style.display = 'flex'
    barNo.style.display  = 'flex'
  }
}
```

- [ ] **Step 3: Actualizar `loadAndPlay` — reemplazar los dos getElementById de título/artista**

En `loadAndPlay`, reemplazar:
```js
// ANTES:
  document.getElementById('song-title').textContent  = song.title
  document.getElementById('song-artist').textContent = song.artist || ''

// DESPUÉS:
  document.getElementById('bar-song-title').textContent   = song.title
  document.getElementById('bar-song-artist').textContent  = song.artist || ''
  document.getElementById('song-title-lyrics').textContent  = song.title
  document.getElementById('song-artist-lyrics').textContent = song.artist || ''
  document.getElementById('song-album-lyrics').textContent  = song.album  || ''
```

En el mismo `loadAndPlay`, también reemplazar el error handler:
```js
// ANTES:
    document.getElementById('song-title').textContent  = '⚠ Error al reproducir'
    document.getElementById('song-artist').textContent = song.path.split('\\').pop()

// DESPUÉS:
    document.getElementById('bar-song-title').textContent  = '⚠ Error al reproducir'
    document.getElementById('bar-song-artist').textContent = song.path.split('\\').pop()
    document.getElementById('song-title-lyrics').textContent  = '⚠ Error al reproducir'
    document.getElementById('song-artist-lyrics').textContent = song.path.split('\\').pop()
```

- [ ] **Step 4: Eliminar las funciones de color dinámico**

Eliminar los cuerpos completos de estas tres funciones del archivo:
- `function extractColor(dataUrl, cb) { ... }` (la función entera)
- `function applyAccent(r, g, b) { ... }` (la función entera)
- `function resetAccent() { ... }` (la función entera)

- [ ] **Step 5: Actualizar listeners de búsqueda y nav-tabs al inicio del archivo**

Encontrar y eliminar estas dos líneas:
```js
document.getElementById('search-artists').addEventListener('input', e => buildArtistList(e.target.value))
```
```js
document.getElementById('search-folders').addEventListener('input', e => buildFolderList(e.target.value))
```

Encontrar el bloque completo de nav-tabs (desde `document.querySelectorAll('.nav-tab')` hasta el cierre `})`de ese forEach) y eliminarlo entero.

- [ ] **Step 6: Verificar**

Ejecutar `npm start`. La app debe cargar canciones. Al reproducir una canción: la barra inferior debe mostrar título y artista correctamente. No debe haber errores de consola sobre elementos no encontrados.

- [ ] **Step 7: Commit**

```bash
git add renderer.js
git commit -m "feat: update DOM IDs for new layout, remove dynamic accent colors"
```

---

## Task 4: Sistema de vistas + sidebar nav + toggle letra

**Files:**
- Modify: `renderer.js`

- [ ] **Step 1: Agregar estado de vistas y función `showView`**

Agregar después de la sección de State (después de `let curLyric = -1`):

```js
// ── View state ────────────────────────────────────────────────────────────────
let currentView  = 'home'
let previousView = 'home'

function showView(name) {
  document.getElementById('view-home').style.display    = name === 'home'    ? 'flex' : 'none'
  document.getElementById('view-library').style.display = name === 'library' ? 'flex' : 'none'
  document.getElementById('view-lyrics').style.display  = name === 'lyrics'  ? 'flex' : 'none'
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === (name === 'lyrics' ? previousView : name))
  )
  document.getElementById('btn-lyrics').classList.toggle('active', name === 'lyrics')
  if (name !== 'lyrics') previousView = name
  currentView = name
}
```

- [ ] **Step 2: Agregar listeners de sidebar y botón de letra**

Agregar después del bloque de Transport buttons (después de `btn-queue-close`):

```js
// ── Sidebar nav ───────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view))
})

document.getElementById('btn-lyrics').addEventListener('click', () => {
  if (currentView === 'lyrics') showView(previousView)
  else showView('lyrics')
})
```

- [ ] **Step 3: Actualizar `switchToSongs` para usar `showView`**

Encontrar la función `switchToSongs` y reemplazarla:

```js
function switchToSongs(label) {
  document.getElementById('filter-label').textContent = label
  document.getElementById('filter-bar').style.display = 'flex'
  showView('library')
}
```

- [ ] **Step 4: Verificar**

Ejecutar `npm start`. Hacer click en "Inicio" y "Biblioteca" en la sidebar — debe cambiar la vista. Hacer click en el botón 📝 de la barra inferior — debe mostrar la vista de letra (vacía si no hay canción). Click de nuevo → vuelve a la vista anterior.

- [ ] **Step 5: Commit**

```bash
git add renderer.js
git commit -m "feat: add view switching system and sidebar navigation"
```

---

## Task 5: Home view — recientes, artistas y álbumes

**Files:**
- Modify: `renderer.js`

- [ ] **Step 1: Agregar estado `recentlyPlayed` y función `addToRecents`**

Agregar después de `let currentView = 'home'` / `let previousView = 'home'`:

```js
let recentlyPlayed = []  // máx 20, más reciente primero

function addToRecents(song) {
  recentlyPlayed = [song, ...recentlyPlayed.filter(s => s.path !== song.path)].slice(0, 20)
  buildRecentsInSidebar()
  if (currentView === 'home') buildHomeRecents()
}
```

- [ ] **Step 2: Llamar `addToRecents` desde `loadAndPlay`**

En `loadAndPlay`, añadir después de `const song = currentSong`:

```js
  addToRecents(song)
```

- [ ] **Step 3: Agregar función `buildRecentsInSidebar`**

```js
function buildRecentsInSidebar() {
  const ul = document.getElementById('recents-list')
  ul.innerHTML = ''
  const frag = document.createDocumentFragment()
  recentlyPlayed.slice(0, 8).forEach(song => {
    const li = document.createElement('li')
    const thumb = document.createElement('div')
    thumb.className = 'rl-thumb'
    if (song.cover) {
      const img = document.createElement('img'); img.src = song.cover; img.alt = ''
      thumb.appendChild(img)
    } else {
      thumb.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>'
    }
    const name = document.createElement('span')
    name.className = 'rl-name'
    name.textContent = song.title
    li.appendChild(thumb); li.appendChild(name)
    li.addEventListener('click', () => {
      let idx = filtered.indexOf(song)
      if (idx < 0) { setFiltered([...allSongs]); idx = allSongs.indexOf(song) }
      if (idx >= 0) loadAndPlay(idx)
    })
    frag.appendChild(li)
  })
  ul.appendChild(frag)
}
```

- [ ] **Step 4: Agregar función `buildHomeRecents`**

```js
function buildHomeRecents() {
  const grid = document.getElementById('recents-grid')
  grid.innerHTML = ''
  const items = recentlyPlayed.length > 0 ? recentlyPlayed.slice(0, 6) : allSongs.slice(0, 6)
  const frag  = document.createDocumentFragment()
  items.forEach(song => {
    const card = document.createElement('div')
    card.className = 'recent-card'
    if (song.cover) {
      const img = document.createElement('img')
      img.className = 'recent-card-img'; img.src = song.cover; img.alt = ''
      card.appendChild(img)
    } else {
      const nt = document.createElement('div')
      nt.className = 'recent-card-nothumb'
      nt.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>'
      card.appendChild(nt)
    }
    const name = document.createElement('span')
    name.className = 'recent-card-name'; name.textContent = song.title
    card.appendChild(name)
    card.addEventListener('click', () => {
      const idx = filtered.indexOf(song) >= 0 ? filtered.indexOf(song) : (() => {
        setFiltered([...allSongs]); return allSongs.indexOf(song)
      })()
      loadAndPlay(idx)
    })
    frag.appendChild(card)
  })
  grid.appendChild(frag)
}
```

- [ ] **Step 5: Agregar función `buildHomeArtists`**

```js
function buildHomeArtists() {
  const row = document.getElementById('home-artists')
  row.innerHTML = ''
  const frag = document.createDocumentFragment()
  const noPersonSvg = '<svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>'
  getArtists().slice(0, 10).forEach(artist => {
    const card = document.createElement('div'); card.className = 'artist-hcard'
    const avatar = document.createElement('div'); avatar.className = 'artist-hcard-avatar'
    if (artist.cover) {
      const img = document.createElement('img'); img.src = artist.cover; img.alt = ''
      avatar.appendChild(img)
    } else { avatar.innerHTML = noPersonSvg }
    const nameEl = document.createElement('div'); nameEl.className = 'artist-hcard-name'; nameEl.textContent = artist.name
    const subEl  = document.createElement('div'); subEl.className  = 'artist-hcard-sub';  subEl.textContent  = `${artist.songs.length} canciones`
    card.appendChild(avatar); card.appendChild(nameEl); card.appendChild(subEl)
    card.addEventListener('click', () => { setFiltered(artist.songs); renderList(); switchToSongs(artist.name) })
    frag.appendChild(card)
  })
  row.appendChild(frag)
}
```

- [ ] **Step 6: Agregar función `buildHomeAlbums`**

```js
function buildHomeAlbums() {
  const row = document.getElementById('home-albums')
  row.innerHTML = ''
  const frag = document.createDocumentFragment()
  const folderSvg = '<svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
  getFolders().slice(0, 10).forEach(folder => {
    const card = document.createElement('div'); card.className = 'album-hcard'
    const thumb = document.createElement('div'); thumb.className = 'album-hcard-thumb'
    if (folder.cover) {
      const img = document.createElement('img'); img.src = folder.cover; img.alt = ''
      thumb.appendChild(img)
    } else { thumb.innerHTML = folderSvg }
    const nameEl = document.createElement('div'); nameEl.className = 'album-hcard-name'; nameEl.textContent = folder.name
    const subEl  = document.createElement('div'); subEl.className  = 'album-hcard-sub';  subEl.textContent  = `${folder.songs.length} canciones`
    card.appendChild(thumb); card.appendChild(nameEl); card.appendChild(subEl)
    card.addEventListener('click', () => { setFiltered(folder.songs); renderList(); switchToSongs(folder.name) })
    frag.appendChild(card)
  })
  row.appendChild(frag)
}
```

- [ ] **Step 7: Agregar función `buildHomeView` y saludo dinámico**

```js
function buildHomeView() {
  const h = new Date().getHours()
  document.getElementById('home-greeting').textContent =
    h >= 6 && h < 12 ? 'Buenos días' :
    h >= 12 && h < 18 ? 'Buenas tardes' : 'Buenas noches'
  buildHomeRecents()
  buildHomeArtists()
  buildHomeAlbums()
}
```

- [ ] **Step 8: Llamar `buildHomeView` al terminar `scanLibrary`**

En `scanLibrary`, reemplazar la última parte:
```js
// ANTES:
  _artistsCache = null
  setLibCount(`${allSongs.length} canciones`)
  const activeTab = document.querySelector('.nav-tab.active')?.dataset?.tab
  if (activeTab === 'artists') buildArtistList()

// DESPUÉS:
  _artistsCache = null
  setLibCount(`${allSongs.length} canciones`)
  if (currentView === 'home') buildHomeView()
```

- [ ] **Step 9: Verificar**

Ejecutar `npm start`. La vista de Inicio debe mostrar "Buenos días/tardes/noches", una grid de recientes (primeras 6 canciones), fila de artistas y fila de álbumes/carpetas. Al reproducir una canción, los recientes en la sidebar y en la grid deben actualizarse.

- [ ] **Step 10: Commit**

```bash
git add renderer.js
git commit -m "feat: add Home view with recently played, artists, and albums sections"
```

---

## Task 6: Cleanup — eliminar código de la UI antigua

**Files:**
- Modify: `renderer.js`

- [ ] **Step 1: Eliminar funciones de la UI antigua que ya no existen en el HTML**

Eliminar estas tres funciones completas:
- `function buildArtistList(query = '') { ... }` (busca `#artist-list` que ya no existe)
- `function buildFolderList(query = '') { ... }` (busca `#folder-list` que ya no existe)
- `const noPersonSvg = ...` (la constante antes de `deferImgs`)

Eliminar la función `switchToSongs` del cuerpo del archivo si quedó duplicada (ya se definió en Task 4).

- [ ] **Step 2: Verificar que no hay referencias a IDs eliminados**

Ejecutar `npm start` y abrir DevTools (Ctrl+Shift+I). Verificar que no hay errores `Cannot set properties of null` o `getElementById returned null` en la consola.

- [ ] **Step 3: Verificar flujo completo**

1. App abre → Vista Home con recientes/artistas/álbumes
2. Click "Biblioteca" → lista de canciones con virtual scroll
3. Buscar en la barra → lista filtrada con debounce
4. Click en artista desde Home → vista Biblioteca filtrada por artista
5. Reproducir canción → barra inferior muestra título/artista/cover
6. Click 📝 → vista Letra con letra sincronizada y cover a la derecha
7. Click 📝 de nuevo → vuelve a la vista anterior

- [ ] **Step 4: Commit**

```bash
git add renderer.js
git commit -m "feat: remove old sidebar tabs and folder/artist list DOM functions"
```

---

## Verificación final

```bash
cd C:\Users\HUAWEI\Music\Project\MusicPlayerElectron
npm start
```

- [ ] App abre con sidebar verde, área central, barra de player abajo
- [ ] Vista Home: saludo, grid recientes, fila artistas, fila álbumes
- [ ] Vista Biblioteca: lista con virtual scroll, búsqueda funcional
- [ ] Vista Letra: letra sincronizada centro + cover+artista+spectrum a la derecha
- [ ] Toggle 📝 alterna entre vista letra y vista anterior
- [ ] Sidebar muestra las últimas 8 canciones reproducidas
- [ ] Queue panel overlay funciona igual que antes
- [ ] Shuffle / Repeat / botones de la barra funcionan
- [ ] Sin errores en consola de DevTools
