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
