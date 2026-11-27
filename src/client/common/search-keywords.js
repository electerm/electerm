/**
 * Parse the bookmark search query.
 *
 * Tokens are separated by whitespace and are ANDed together. A token starting
 * with `!` excludes matches; `\!` escapes the `!` and matches it literally.
 */

const escapedNegation = '\\!'
const negation = '!'

export function parseSearchKeywords (keyword = '') {
  const tokens = String(keyword || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const include = []
  const exclude = []
  for (const token of tokens) {
    if (token.startsWith(escapedNegation)) {
      include.push(token.slice(1))
    } else if (token.startsWith(negation) && token.length > 1) {
      exclude.push(token.slice(1))
    } else {
      include.push(token)
    }
  }
  return {
    include,
    exclude
  }
}

export function hasSearchKeywords ({ include, exclude }) {
  return include.length > 0 || exclude.length > 0
}

export function matchesSearchKeywords (text, { include, exclude }) {
  const lowerText = String(text || '').toLowerCase()
  return include.every(term => lowerText.includes(term.toLowerCase())) &&
    exclude.every(term => !lowerText.includes(term.toLowerCase()))
}

export function getHighlightRanges (text, keywords) {
  if (!text || !keywords.length) return []
  const lowerText = text.toLowerCase()
  const matchEnds = new Uint32Array(lowerText.length)
  for (const keyword of keywords) {
    if (!keyword) continue
    const term = keyword.toLowerCase()
    let start = lowerText.indexOf(term)
    while (start !== -1) {
      matchEnds[start] = Math.max(matchEnds[start], start + term.length)
      start = lowerText.indexOf(term, start + 1)
    }
  }

  // Match in the lowercased title, but return offsets into the displayed title.
  // One original character can cover multiple lowercase code units (İ → i̇).
  const ranges = []
  const sameLength = lowerText.length === text.length
  let originalStart = 0
  let lowerStart = 0
  let matchEnd = 0
  for (const char of text) {
    const originalEnd = originalStart + char.length
    const lowerEnd = lowerStart + (sameLength ? char.length : char.toLowerCase().length)
    for (let i = lowerStart; i < lowerEnd; i++) {
      matchEnd = Math.max(matchEnd, matchEnds[i])
    }
    if (matchEnd > lowerStart) {
      const last = ranges[ranges.length - 1]
      if (last && last.end === originalStart) last.end = originalEnd
      else ranges.push({ start: originalStart, end: originalEnd })
    }
    originalStart = originalEnd
    lowerStart = lowerEnd
  }
  return ranges
}
