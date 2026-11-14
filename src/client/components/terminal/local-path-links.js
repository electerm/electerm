/**
 * Local path detection / resolution for ctrl+click on terminal output.
 *
 * A local terminal prints file paths that mean nothing to the web-link addon:
 * `D:\work\project\a.ts`, `src\a.ts`, `/var/log/syslog`. Windows Terminal opens
 * the containing folder on ctrl+click; electerm had no local path link at all,
 * and the one path it could be asked to reveal resolved against the *process*
 * cwd, which is the home directory (or the desktop, launched from a shortcut)
 * rather than the shell's directory (#4737).
 *
 * Everything here is pure so the parsing rules can be unit tested without a
 * terminal: `findPathCandidates` picks tokens that *look* like paths and
 * `resolveLocalPath` turns one into an absolute path against a given cwd. The
 * caller still has to verify the result exists before offering a link - that is
 * what keeps prose like `and/or` out of the link list.
 */

// A token ends at whitespace or at a character that cannot appear in a path we
// would want to open: quotes, redirection, pipes, backticks. A quoted string is
// one token, so `"C:\Program Files\a.ts"` survives its spaces - an *unquoted*
// path with a space is ambiguous and is not guessed at.
const tokenRe = /"[^"]*"|'[^']*'|[^\s"'`<>|]+/g

const trailingPunctuationRe = /[.,;:!?]+$/

const leadingBracketsRe = /^[(<[{]+/

// `http://x/y` is the web link addon's job, and `a:b` (file:line) is not a path
// on POSIX either.
const urlRe = /^[a-z][a-z0-9+.-]*:\/\//i

// A Windows drive path, and a UNC path (`\\server\share\dir`).
const winAbsoluteRe = /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/

const winRootRelativeRe = /^[\\/](?![\\/])/

function countChar (str, char) {
  let n = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) n++
  }
  return n
}

/**
 * Drop the parts a terminal tends to glue onto a path: an opening bracket from
 * `(src/a.ts)`, a sentence comma or full stop. A closing bracket is kept when
 * the token itself opened it, so `C:\Program Files (x86)` survives.
 */
export function trimPathToken (token) {
  let out = token.replace(leadingBracketsRe, '').replace(trailingPunctuationRe, '')
  const pairs = [['(', ')'], ['[', ']'], ['{', '}']]
  let changed = true
  while (changed && out) {
    changed = false
    for (const [open, close] of pairs) {
      if (
        out.endsWith(close) &&
        countChar(out, close) > countChar(out, open)
      ) {
        out = out.slice(0, -1).replace(trailingPunctuationRe, '')
        changed = true
      }
    }
  }
  return out
}

/**
 * Is this bare token worth resolving?
 *
 * A relative token must contain a separator (`src\a.ts`, `./a.ts`, `a/b`) - a
 * bare word is not a path, and linkifying every word of every line would make
 * the terminal unusable and cost one existence check per word.
 */
export function isPathLike (token, { isWin = false } = {}) {
  // `~` needs shell expansion we do not have, on every platform
  if (!token || token.startsWith('~') || urlRe.test(token)) {
    return false
  }
  if (isWin) {
    if (winAbsoluteRe.test(token) || winRootRelativeRe.test(token)) {
      return true
    }
    // `src\a.ts` / `src/a.ts` - a separator is what makes it a path, and a
    // leading `-` means a command line flag, not a file
    return /[\\/]/.test(token) && !token.startsWith('-')
  }
  return token.includes('/') && !token.startsWith('-')
}

/**
 * Split a path into its root and its segments, keeping `.`/`..` for the caller
 * to collapse. Windows keeps the drive (`D:`) or the UNC prefix (`\\srv\share`).
 */
function splitLocalPath (value, isWin) {
  if (isWin) {
    const uncMatch = /^\\\\+([^\\/]+)[\\/]+([^\\/]+)/.exec(value)
    if (uncMatch) {
      return {
        root: '\\\\' + uncMatch[1] + '\\' + uncMatch[2],
        rest: value.slice(uncMatch[0].length),
        sep: '\\'
      }
    }
    const driveMatch = /^([A-Za-z]:)/.exec(value)
    if (driveMatch) {
      return {
        root: driveMatch[1] + '\\',
        rest: value.slice(driveMatch[1].length),
        sep: '\\'
      }
    }
    if (winRootRelativeRe.test(value)) {
      return { root: '\\', rest: value, sep: '\\' }
    }
    return { root: '', rest: value, sep: '\\' }
  }
  if (value.startsWith('/')) {
    return { root: '/', rest: value, sep: '/' }
  }
  return { root: '', rest: value, sep: '/' }
}

/**
 * Collapse `.` and `..` and normalize the separators of an absolute local path.
 * Only used to build the path we are about to stat/open, so the OS does the
 * final resolution; a path this cannot make sense of simply will not exist.
 */
export function normalizeLocalPath (value, { isWin = false } = {}) {
  if (typeof value !== 'string' || !value) {
    return ''
  }
  const { root, rest, sep } = splitLocalPath(value, isWin)
  const parts = rest.split(/[\\/]+/)
  const out = []
  for (const part of parts) {
    if (!part || part === '.') {
      continue
    }
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') {
        out.pop()
      } else if (!root) {
        out.push('..')
      }
      continue
    }
    out.push(part)
  }
  const body = out.join(sep)
  if (root) {
    return /[\\/]$/.test(root) ? root + body : root + sep + body
  }
  return body
}

export function isAbsoluteLocalPath (value, { isWin = false } = {}) {
  if (typeof value !== 'string' || !value) {
    return false
  }
  if (isWin) {
    return winAbsoluteRe.test(value) || winRootRelativeRe.test(value)
  }
  return value.startsWith('/')
}

/**
 * Absolute path for a token, or '' when it cannot be resolved (a relative path
 * with no cwd to resolve against - no shell integration, no start directory).
 */
export function resolveLocalPath (token, cwd, { isWin = false } = {}) {
  if (isAbsoluteLocalPath(token, { isWin })) {
    return normalizeLocalPath(token, { isWin })
  }
  if (!cwd || !isAbsoluteLocalPath(cwd, { isWin })) {
    return ''
  }
  const sep = isWin ? '\\' : '/'
  const base = cwd.replace(/[\\/]+$/, '')
  return normalizeLocalPath(base + sep + token, { isWin })
}

/**
 * Convert a `file://` URI (OSC 8 hyperlink) into a local filesystem path.
 *
 * `file:///D:/work/a.ts` on Windows, `file:///home/me/a.ts` on POSIX, and
 * `file://server/share/a.ts` for a UNC share. Returns '' for anything else, so
 * a stray scheme never reaches the file manager.
 */
export function fileUrlToPath (url, { isWin = false } = {}) {
  if (typeof url !== 'string' || !/^file:\/\//i.test(url)) {
    return ''
  }
  let rest = url.slice('file://'.length)
  // fragments/queries are not part of a file name
  const cut = rest.search(/[?#]/)
  if (cut !== -1) {
    rest = rest.slice(0, cut)
  }
  let host = ''
  if (rest.startsWith('/')) {
    rest = rest.slice(1)
  } else {
    const slash = rest.indexOf('/')
    if (slash === -1) {
      host = rest
      rest = ''
    } else {
      host = rest.slice(0, slash)
      rest = rest.slice(slash + 1)
    }
  }
  try {
    rest = decodeURIComponent(rest)
    host = decodeURIComponent(host)
  } catch (err) {
    // a malformed escape sequence: keep the raw text rather than dropping it
  }
  if (isWin) {
    if (host) {
      return normalizeLocalPath('\\\\' + host + '\\' + rest.split('/').join('\\'), { isWin })
    }
    return normalizeLocalPath(rest.split('/').join('\\'), { isWin })
  }
  if (!rest) {
    return ''
  }
  return normalizeLocalPath('/' + rest, { isWin })
}

/**
 * One buffer line as a string plus, for every character, the cell column it was
 * drawn at. A wide (CJK) character occupies two cells but is one character, so
 * a string index is not a column - and xterm's link ranges are in cells.
 *
 * @param {object} line - an xterm IBufferLine
 * @returns {{text: string, cells: number[]}}
 */
export function readLineCells (line) {
  const chars = []
  const cells = []
  if (!line || typeof line.getCell !== 'function') {
    return { text: '', cells }
  }
  const width = typeof line.length === 'number' ? line.length : 0
  for (let x = 0; x < width; x++) {
    const cell = line.getCell(x)
    if (!cell) {
      continue
    }
    // a width of 0 is the second half of a wide character: no character of
    // its own, the first half already contributed one
    if (cell.getWidth() === 0) {
      continue
    }
    const text = cell.getChars()
    chars.push(text || ' ')
    cells.push(x)
  }
  return {
    text: chars.join(''),
    cells
  }
}

/**
 * All path-looking tokens of one line, with their [start, end) offsets in the
 * string, so the caller can map them back to terminal cells.
 *
 * @param {string} text - one buffer line, without trailing blanks
 * @param {object} options
 * @returns {Array<{text: string, start: number, end: number}>}
 */
export function findPathCandidates (text, { isWin = false } = {}) {
  if (!text) {
    return []
  }
  const out = []
  tokenRe.lastIndex = 0
  let match
  while ((match = tokenRe.exec(text))) {
    let raw = match[0]
    let offset = 0
    const quote = raw[0]
    if (
      raw.length >= 2 &&
      (quote === '"' || quote === "'") &&
      raw[raw.length - 1] === quote
    ) {
      raw = raw.slice(1, -1)
      offset = 1
    }
    const trimmed = trimPathToken(raw)
    if (!trimmed || !isPathLike(trimmed, { isWin })) {
      continue
    }
    // The token may have been trimmed on both sides; keep the offsets honest.
    const start = match.index + offset + raw.indexOf(trimmed)
    out.push({
      text: trimmed,
      start,
      end: start + trimmed.length
    })
  }
  return out
}
