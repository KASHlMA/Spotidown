// Ánimo de una canción a partir de su letra (vocabulario en español e inglés).
// Devuelve, por mood, cuántas palabras clave aparecen por cada 100 palabras;
// el renderer decide los umbrales para poder ajustarlos sin volver a analizar.
const LEXICON = {
  triste: [
    'llor\\w*', 'lagrim\\w*', 'dolor', 'duele\\w*', 'dolio', 'sufr\\w*', 'extran\\w*', 'te fuiste', 'te vas',
    'te perdi', 'adios', 'olvid\\w*', 'soledad', 'vacio', 'trist\\w*', 'herid\\w*', 'roto', 'rota',
    'sin ti', 'me dejaste', 'despecho', 'traicion\\w*', 'engan\\w*', 'mentira\\w*', 'depre\\w*',
    'me muero', 'agonia', 'nostalgia', 'recuerdo\\w*', 'ya no estas', 'ya no me', 'nunca mas',
    'cry\\w*', 'tears', 'miss you', 'alone', 'lonely', 'sad', 'broken', 'goodbye', 'hurt\\w*', 'pain',
  ],
  romance: [
    'te amo', 'amarte', 'te quiero', 'quererte', 'beso\\w*', 'besar\\w*', 'enamor\\w*', 'mi vida',
    'carino', 'juntos', 'para siempre', 'abraz\\w*', 'tu mirada', 'tus ojos', 'tu sonrisa', 'mi reina',
    'princesa', 'mi amor', 'contigo', 'love you', 'kiss\\w*', 'forever', 'my love', 'darling',
  ],
  feliz: [
    'feliz', 'felices', 'felicidad', 'alegr\\w*', 'sonri\\w*', 'sonrisa', 'reir', 'risa\\w*', 'disfrut\\w*',
    'gozar', 'goza\\w*', 'celebr\\w*', 'buena vibra', 'vivir la vida', 'que bonito', 'sol', 'happy',
    'smile', 'good vibes', 'sunshine', 'celebrate',
  ],
  bailar: [
    'bail\\w*', 'perre\\w*', 'pista', 'discoteca', 'disco', 'party', 'rumba', 'parranda', 'fiesta\\w*',
    'mueve\\w*', 'muevel\\w*', 'menea\\w*', 'dale', 'dj', 'antro', 'twerk', 'dance', 'dancing',
    'hasta abajo', 'pa\\W?l piso', 'sandunga', 'cintura',
  ],
  peda: [
    'cerve\\w*', 'chela\\w*', 'tequila', 'mezcal', 'whisky', 'buchanan\\w*', 'pisto', 'peda', 'borrach\\w*',
    'botella\\w*', 'trago\\w*', 'copas', 'alcohol', 'tomando', 'bebiendo', 'shot\\w*',
    'ron', 'vodka', 'cantina', 'moet', 'champagne', 'don julio', 'brindar', 'brindis', 'drunk', 'drink\\w*',
  ],
}

const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const PATTERNS = Object.fromEntries(Object.entries(LEXICON).map(([mood, words]) =>
  [mood, new RegExp(`\\b(?:${words.join('|')})\\b`, 'g')]))

function lyricsMood(raw) {
  const text = fold(String(raw || ''))
    .replace(/\[[^\]]*\]/g, ' ')          // marcas de tiempo LRC
    .replace(/[^a-z0-9'\s]/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  if (words < 40) return null              // sin letra o instrumental
  const out = { words }
  for (const [mood, re] of Object.entries(PATTERNS)) {
    const n = (text.match(re) || []).length
    out[mood] = +(n * 100 / words).toFixed(2)
  }
  return out
}

module.exports = { lyricsMood }
