# Performance Improvements — Design Spec

**Date:** 2026-05-30  
**Project:** MusicPlayerElectron  
**Goal:** Make the app feel instant on libraries of 5000+ songs via metadata caching, virtual scroll, and debounced search.

---

## Problem Statement

With 5000+ MP3s the app has three distinct bottlenecks:

1. **Startup time** — `read-meta` is called for every song sequentially on every launch (~50ms × 5000 = ~4 minutes). The list is blank or partial for minutes.
2. **Scroll lag** — all 5000 `<li>` nodes exist in the DOM simultaneously, causing layout thrashing on every scroll event and sluggish rendering.
3. **Search lag** — filtering re-renders the full list on every keystroke, causing noticeable input lag.

---

## Solution Overview

Three independent improvements applied together:

```
main.js                              renderer.js
──────────────────────────────────────────────────────────
scan-music IPC                       virtualScroll.render()
  → load cache JSON (instant)           renders ~20 <li> only
  → diff against filesystem          
  → read only new/changed MP3s   →   debounced filterSongs()
  → save updated cache                  300ms delay on input
  → return full song list
```

**Startup with warm cache:** < 1 second  
**Startup cold (first run):** ~30 seconds (8 parallel reads)  
**Scroll:** 60–120fps depending on display refresh rate  
**Search:** one render per typing pause, not per keystroke  

---

## Component 1: Metadata Cache

### Location
`<app.getPath('userData')>/music-cache.json`

### Schema
```json
{
  "version": 1,
  "songs": {
    "/absolute/path/to/song.mp3": {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 213.4,
      "mtime": 1748000000000
    }
  }
}
```

**Note:** Cover art (`cover`) is intentionally excluded from the cache. A base64 JPEG per song can be 50–200KB; for 5000 songs that would make the cache file 250–1000MB. Covers are loaded on-demand when a song is played and held in memory only for the current song.

### Invalidation Logic
- Each entry stores `mtime` (file modification timestamp in milliseconds, from `fs.stat().mtimeMs`)
- On scan: if a path exists in cache **and** its `mtime` matches the file's current `mtime` → use cached data, skip `read-meta`
- If path is new or `mtime` differs → call `read-meta`, update cache entry
- After scan: remove cache entries whose paths no longer exist on disk (deleted files)
- Write updated cache to disk after all new entries are resolved

### Files Modified
- `main.js` — new `load-cache` and `save-cache` IPC handlers; updated `scan-music` handler to return cached metadata alongside paths
- `preload.js` — expose `loadCache`, `saveCache`
- `renderer.js` — `scanLibrary()` uses cache on startup; saves cache after metadata is loaded

---

## Component 2: Virtual Scroll

### Behavior
Only the ~20 `<li>` elements currently visible in the viewport exist in the DOM. Two invisible spacer `<div>`s maintain the correct scrollbar height.

```
┌─────────────────────────┐  ← #song-list (overflow-y: auto, fixed height)
│  spacer-top             │  ← height = startIndex × ROW_HEIGHT
│─────────────────────────│
│  <li> visible row 0     │
│  <li> visible row 1     │  ← ~20 real <li> elements
│  ...                    │
│  <li> visible row N     │
│─────────────────────────│
│  spacer-bottom          │  ← height = (total - endIndex) × ROW_HEIGHT
└─────────────────────────┘
```

### Constants
- `ROW_HEIGHT = 52` — fixed height in px for every `<li>`. Enables O(1) index calculation.
- `OVERSCAN = 3` — extra rows rendered above and below the visible area to prevent flicker during fast scroll.
- Buffer = `Math.ceil(listHeight / ROW_HEIGHT) + OVERSCAN * 2`

### Scroll Handler
```
scroll event → requestAnimationFrame → recalculate startIndex → patch DOM
```
`requestAnimationFrame` batches the DOM update to the next vsync, enabling 60–120fps depending on display refresh rate.

### Index Calculation (O(1))
```js
startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
endIndex   = Math.min(total, startIndex + buffer)
```

### DOM Patching
On each frame, recycle existing `<li>` elements: update their `textContent` and data attributes in place rather than destroying and recreating them. Only add/remove `<li>` nodes when the visible count changes (rare).

### Active Song Highlight
`loadAndPlay(idx)` sets `currentSong`. Virtual scroll checks `filtered[i] === currentSong` to apply the `.active` class when rendering each row.

### Files Modified
- `renderer.js` — replace `renderList()` with a `VirtualScroll` object containing `render()`, `scrollToIndex()`, and `onScroll()` methods; wire `#song-list` scroll event.
- `styles.css` — add `#song-list li { height: 52px }` and remove any `min-height` that conflicts.
- `index.html` — no changes needed.

---

## Component 3: Debounced Search + Parallel Metadata Loading

### Debounced Search
`filterSongs()` (triggered on `#search` input event) gains a 300ms debounce:

```js
let searchTimer = null
function filterSongs() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    applyFilter()
    virtualScroll.render()
  }, 300)
}
```

Result: no re-render fires while the user is mid-word. One render fires 300ms after the last keystroke.

### Parallel Metadata Reading
When there are uncached songs to read (first run or new files), read them in batches of 8 concurrently using `Promise.all`:

```js
const BATCH = 8
for (let i = 0; i < uncached.length; i += BATCH) {
  const batch = uncached.slice(i, i + BATCH)
  await Promise.all(batch.map(path => api.readMeta(path).then(meta => {
    Object.assign(songMap[path], meta)
    updateVirtualScroll()
  })))
}
```

8 concurrent reads is the practical limit before disk I/O becomes the bottleneck. Each batch completes before the next begins, giving a predictable memory footprint.

### Files Modified
- `renderer.js` — debounce wrapper in `filterSongs()`; batch loop in `scanLibrary()`

---

## Data Flow Summary

```
App start
  │
  ├─ loadCache() ──────────────────────────────────→ allSongs populated from JSON
  │   (< 50ms for 5000 entries, no covers)              │
  │                                                      ↓
  │                                               virtualScroll.render() ← instant
  │
  ├─ scanMusic() ──→ filesystem diff
  │   new paths only ──→ readMeta batch(8)
  │   on each batch ──────────────────────────────→ update allSongs + virtualScroll
  │
  └─ saveCache() ──→ write updated JSON to disk
```

---

## Out of Scope

- SQLite storage (unnecessary for this scale with JSON cache)
- Cover art caching on disk (too much disk space)
- Playlist persistence (separate feature)
- Lyrics caching (LRC data is tiny, not a bottleneck)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Startup time (warm cache) | < 1 second to full list |
| Startup time (cold) | < 60 seconds for 5000 songs |
| Scroll FPS | 60fps minimum, 120fps on 120Hz displays |
| Search input lag | Zero perceived lag (300ms debounce) |
| Cache file size | < 5MB for 5000 songs (no covers) |
