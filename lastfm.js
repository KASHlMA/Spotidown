const fs   = require('fs')
const path = require('path')

const API       = 'https://ws.audioscrobbler.com/2.0/'
const GAP_MS    = 250          // Last.fm permite ~5 peticiones por segundo
const DAY       = 24 * 3600 * 1000
const TAGS_TTL  = 90 * DAY
const SIM_TTL   = 30 * DAY
const MIN_COUNT = 3            // tags con menos peso suelen ser ruido
const TEMP_ERRORS = new Set([8, 11, 16, 29])   // fallos temporales del servidor: no se cachean

const sleep = ms => new Promise(r => setTimeout(r, ms))

function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def }
}

const asList = x => Array.isArray(x) ? x : x ? [x] : []

function cleanTags(list) {
  return asList(list)
    .map(t => [String(t.name || '').toLowerCase().trim(), +t.count || 0])
    .filter(([n, c]) => n && c >= MIN_COUNT)
    .slice(0, 20)
}

// Cliente de Last.fm con caché en disco: etiquetas (géneros / mood) y canciones similares
module.exports = function createLastfm(dir) {
  const SETTINGS_PATH = path.join(dir, 'settings.json')
  const CACHE_PATH    = path.join(dir, 'lastfm-cache.json')
  const settings = readJson(SETTINGS_PATH, {})
  const cache    = Object.assign({ version: 1, tracks: {}, artists: {}, similar: {} }, readJson(CACHE_PATH, {}))

  let saveTimer = null
  // A lo mucho un guardado cada 3 s mientras llegan respuestas
  function scheduleSave() {
    if (!saveTimer) saveTimer = setTimeout(flush, 3000)
  }
  function flush() {
    clearTimeout(saveTimer)
    saveTimer = null
    try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache)) }
    catch (e) { console.error('lastfm cache save error:', e.message) }
  }

  // Todas las peticiones pasan por una cola para respetar el límite de Last.fm
  let chain = Promise.resolve()
  function call(params, key = settings.lastfmKey) {
    const run = chain.then(async () => {
      const url = API + '?' + new URLSearchParams({ ...params, api_key: key, format: 'json', autocorrect: '1' })
      for (let attempt = 0; ; attempt++) {
        let data
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
          data = await res.json()
        } catch (e) {
          if (attempt < 2) { await sleep(2000); continue }
          throw new Error('network')
        }
        if (data.error === 10 || data.error === 26) throw new Error('invalid-key')
        if (TEMP_ERRORS.has(data.error)) {
          if (attempt < 3) { await sleep(5000); continue }
          throw new Error('network')
        }
        return data.error ? null : data   // p. ej. 6 = canción no encontrada
      }
    })
    chain = run.catch(() => {}).then(() => sleep(GAP_MS))
    return run
  }

  const fresh = (entry, ttl) => entry && Date.now() - entry.at < ttl

  return {
    hasKey: () => !!settings.lastfmKey,

    async setKey(key) {
      key = String(key || '').trim()
      if (key) {
        try { await call({ method: 'artist.gettoptags', artist: 'Queen' }, key) }
        catch (e) {
          return { ok: false, error: e.message === 'invalid-key' ? 'La API key no es válida.' : 'No se pudo conectar con Last.fm. Revisa tu internet.' }
        }
        settings.lastfmKey = key
      } else {
        delete settings.lastfmKey
      }
      try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings)) } catch {}
      return { ok: true }
    },

    // Todo lo que ya está en caché, para no repetir peticiones al abrir la app
    cached() {
      const pick = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.tags]))
      return { tracks: pick(cache.tracks), artists: pick(cache.artists) }
    },

    // q = { key, akey, artist, title } — key / akey ya vienen normalizados del renderer
    async tags(q) {
      if (!settings.lastfmKey) return null
      let t = cache.tracks[q.key]
      if (!fresh(t, TAGS_TTL)) {
        const d = await call({ method: 'track.gettoptags', artist: q.artist, track: q.title })
        t = cache.tracks[q.key] = { tags: cleanTags(d?.toptags?.tag), at: Date.now() }
        scheduleSave()
      }
      let a = cache.artists[q.akey]
      if (!fresh(a, TAGS_TTL)) {
        const d = await call({ method: 'artist.gettoptags', artist: q.artist })
        a = cache.artists[q.akey] = { tags: cleanTags(d?.toptags?.tag), at: Date.now() }
        scheduleSave()
      }
      return { track: t.tags, artist: a.tags }
    },

    async similar(q) {
      if (!settings.lastfmKey) return null
      const s = cache.similar[q.key]
      if (fresh(s, SIM_TTL)) return s.data
      const [tr, ar] = await Promise.all([
        call({ method: 'track.getsimilar', artist: q.artist, track: q.title, limit: '150' }),
        call({ method: 'artist.getsimilar', artist: q.artist, limit: '50' }),
      ])
      const data = {
        tracks:  asList(tr?.similartracks?.track).map(x => [x.artist?.name || '', x.name || '', +x.match || 0]),
        artists: asList(ar?.similarartists?.artist).map(x => [x.name || '', +x.match || 0]),
      }
      cache.similar[q.key] = { data, at: Date.now() }
      scheduleSave()
      return data
    },

    flush,
  }
}
