# Spotify-style Redesign — Design Spec

**Date:** 2026-05-30  
**Project:** MusicPlayerElectron  
**Goal:** Rediseñar la UI del reproductor para replicar el layout y estilo visual de Spotify, manteniendo toda la funcionalidad existente.

---

## Layout general

La app pasa de un layout de 3 columnas fijas a una estructura de 2 zonas + barra inferior fija:

```
┌──────────────────────────────────────────────────────┐
│  Sidebar izquierda (140px)  │  Área central (flex:1) │
│  Negro puro #000            │  Fondo #121212          │
│                             │  Vista Home             │
│                             │    ó                    │
│                             │  Vista Letra            │
└─────────────────────────────┴────────────────────────┘
│          Barra de controles inferior (72px fija)      │
│  [Cover+Título+Artista] ← [⏮ ⏸ ⏭ + Progreso] →      │
│                      [🔀][🔁][🔊][≡ Cola][📝 Letra]  │
└──────────────────────────────────────────────────────┘
```

El panel de letras actual (columna central fija) y el panel del player derecho (art + spectrum) **desaparecen**. Sus funciones se redistribuyen en la barra inferior y en la Vista Letra.

---

## Paleta de colores

| Elemento | Color |
|----------|-------|
| Fondo principal | `#121212` |
| Fondo sidebar | `#000000` |
| Fondo barra inferior | `#181818` |
| Borde barra inferior | `#282828` |
| Cards / hover row | `#282828` |
| Hover oscuro | `#1a1a1a` |
| Acento principal | `#1DB954` |
| Texto primario | `#FFFFFF` |
| Texto secundario | `#B3B3B3` |
| Texto terciario | `#6a6a6a` |
| Barra de progreso | fondo `#535353`, activo `#1DB954` |

**Tipografía:** `'Circular Std', system-ui, -apple-system, sans-serif`. Pesos 400 y 700.

**Eliminado:** extracción dinámica de color de portada (`extractColor`, `applyAccent`, `resetAccent`, variables CSS `--accent`, `--acc2`, `--cur-glow`, `--cur-glow2`). El spectrum y elementos activos usan `#1DB954` fijo.

---

## Sidebar izquierda

Ancho fijo **140px**, fondo `#000000`.

**Secciones:**

1. **Logo** — ♫ Music en verde `#1DB954`, bold, 14px
2. **Navegación principal:**
   - ⌂ Inicio — activa Vista Home
   - ⊙ Buscar — activa buscador en el centro
   - ☰ Biblioteca — activa lista completa de canciones
3. **Lista de recientes** (debajo de un separador "RECIENTES"):
   - Las últimas 8 entradas reproducidas (álbumes/artistas/carpetas)
   - Cada ítem: miniatura cuadrada 10×10 + nombre truncado
   - Click → reproduce esa canción / filtra por ese artista/carpeta

**Navegación activa:** ítem resaltado con texto blanco. Los demás en `#B3B3B3`.

---

## Área central — Vista Home

Activada por **Inicio** en la sidebar. Scroll vertical interno.

### Saludo dinámico
Título grande según hora del sistema:
- 6:00–11:59 → "Buenos días"
- 12:00–17:59 → "Buenas tardes"
- 18:00–5:59 → "Buenas noches"

### Escuchado recientemente (grid 2×3)
- Las últimas 6 canciones reproducidas (historial en memoria, se pierde al cerrar la app)
- Cada card: portada a la izquierda (30×30px, esquinas redondeadas) + nombre de canción truncado + hover con botón ▶ verde a la derecha
- Click → `loadAndPlay(idx)`
- Si no hay historial: mostrar las primeras 6 canciones de `allSongs`

### Tus artistas (fila horizontal, scroll)
- Los N artistas con más canciones en la biblioteca (máximo 10 visibles)
- Avatar circular 54×54px con portada del artista (primera canción con cover) o placeholder SVG
- Nombre debajo en `#B3B3B3`, 10px
- Click → activa Vista Biblioteca filtrada por ese artista (igual que antes con `setFiltered`)

### Tus álbumes (fila horizontal, scroll)
- Las carpetas de la biblioteca tratadas como álbumes
- Card 58×58px + nombre + artista/conteo debajo
- Click → activa Vista Biblioteca filtrada por esa carpeta

---

## Área central — Vista Biblioteca

Activada por **Biblioteca** en la sidebar o por click en artista/carpeta/álbum desde Home.

Muestra la lista completa de canciones con el virtual scroll existente (52px por fila). Mantiene la barra de búsqueda en la parte superior del área central. El filter-bar (breadcrumb) sigue funcionando igual.

---

## Área central — Vista Buscar

Activada por **Buscar** en la sidebar.

Input de búsqueda grande centrado. Al escribir: filtra `allSongs` y muestra resultados en lista. Reutiliza el debounce (300ms) y `applyFilter()` existentes.

---

## Área central — Vista Letra

Activada por el botón 📝 de la barra inferior. Toggle: vuelve a la vista anterior al pulsarlo de nuevo.

Layout interno de la Vista Letra:

```
┌───────────────────────────────┬──────────────────────┐
│  Letra sincronizada (flex:1)  │  Panel derecho       │
│                               │  (200px, flex-shrink:0)│
│  - scroll automático          │                       │
│  - línea activa: blanca,      │  Portada 160×160px   │
│    font-size grande           │  border-radius 8px   │
│  - líneas cercanas: gris      │                       │
│  - líneas lejanas: oscuro     │  Título canción 14px │
│  - click en línea → seek      │  Artista 12px gris   │
│                               │  Álbum 11px gris     │
│  Sin letra:                   │                       │
│  "Sin letra incrustada"       │  Spectrum 100% ancho │
│  centrado verticalmente       │  barras #1DB954      │
└───────────────────────────────┴──────────────────────┘
```

El spectrum se mueve al panel derecho de la Vista Letra (debajo de la info de la canción).

---

## Barra de controles inferior

Fija en la parte inferior, altura **72px**, fondo `#181818`, borde superior `#282828`.

**Tres zonas:**

### Zona izquierda (flex: 0 0 220px)
- Miniatura de portada: 48×48px, `border-radius: 4px`
- Si no hay portada: placeholder con icono musical
- Título canción (blanco, 13px, truncado) + Artista (gris, 11px, truncado)
- Botón corazón ♡ (favorito — visual only por ahora)

### Zona central (flex: 1, text-align: center)
- Fila de controles: ⏮ · ⏸/▶ · ⏭ + botones shuffle y repeat a los lados
- Debajo: tiempo actual · barra de progreso · tiempo total
- Barra de progreso: ancho completo de la zona central, arrastrable

### Zona derecha (flex: 0 0 180px, justify-content: flex-end)
- Botón shuffle (🔀) — resaltado en verde si activo
- Botón repeat (🔁) — resaltado en verde si activo
- Icono volumen + slider de volumen (80px)
- Botón cola (≡)
- Botón letra (📝) — resaltado en verde si Vista Letra activa

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `index.html` | Reescritura total del HTML |
| `styles.css` | Reescritura total del CSS |
| `renderer.js` | Nuevas funciones de vistas, adaptación de existentes |
| `main.js` | Sin cambios |
| `preload.js` | Sin cambios |

---

## Funcionalidad preservada

Todo lo siguiente se mantiene sin cambios de comportamiento:
- Virtual scroll en lista de canciones
- Caché de metadata JSON
- Búsqueda con debounce 300ms
- Letras LRC sincronizadas (parseLrc, syncLyrics)
- Shuffle / Repeat / Queue panel
- Web Audio API (spectrum, gain)
- Controles de ventana (frame: false, titlebar custom)
- IPC handlers (scan-music, read-meta, load-cache, save-cache)

---

## Historial de reproducción

Array en memoria: `recentlyPlayed = []` (máximo 20 entradas).  
Cada vez que `loadAndPlay(idx)` se llama, se agrega `allSongs[idx]` al frente del array (deduplicado por path). No se persiste en disco — se reinicia con cada sesión.

---

## Fuera de scope

- Playlists guardadas en disco
- Favoritos persistentes
- Integración con servicios externos
- Animaciones de transición entre vistas (fade simple es suficiente)
