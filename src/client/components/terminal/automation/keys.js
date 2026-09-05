// Expands control-char escapes typed by users, e.g. in trigger send text:
// \n \t \r \\ \xHH hex bytes and ^X caret notation (^M = \r, ^C = \x03)
export function expandControlChars (text) {
  if (!text) {
    return ''
  }
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\\' && i + 1 < text.length) {
      const next = text[i + 1]
      if (next === 'n') {
        result += '\n'
        i++
      } else if (next === 't') {
        result += '\t'
        i++
      } else if (next === 'r') {
        result += '\r'
        i++
      } else if (next === '\\') {
        result += '\\'
        i++
      } else if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
        result += String.fromCharCode(parseInt(text.slice(i + 2, i + 4), 16))
        i += 3
      } else {
        result += c
      }
    } else if (c === '^' && i + 1 < text.length && /[@A-Z[\\\]^_]/.test(text[i + 1])) {
      result += String.fromCharCode(text.charCodeAt(i + 1) - 64)
      i++
    } else {
      result += c
    }
  }
  return result
}

export function escapeRegExp (s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function toSafeRegExp (pattern, flags = '') {
  if (pattern instanceof RegExp) {
    return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '') + flags.replace(/[gy]/g, ''))
  }
  return new RegExp(pattern, flags.replace(/[gy]/g, ''))
}
