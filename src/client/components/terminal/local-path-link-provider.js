/**
 * Ctrl+click on a local file path in a terminal opens its folder.
 *
 * xterm's web-link addon only knows about `http(s)://`, and the OSC 8 handler
 * drops every other scheme, so `D:\work\a.ts`, `src\a.ts` and `/var/log/syslog`
 * were plain text in a local tab. Windows Terminal resolves them against the
 * shell's current directory and opens the file location; this provider does the
 * same (#4737).
 *
 * Rules:
 * - only tokens that look like a path AND exist on disk become links, so prose
 *   such as `and/or` never turns into a click target (and the existence check
 *   is what makes a *relative* path safe to offer at all);
 * - a relative path is resolved against the live shell cwd (OSC 633), falling
 *   back to the directory the shell was started in;
 * - whether a click needs ctrl/meta is the caller's call, so paths follow the
 *   same `ctrlOrMetaOpenTerminalLink` switch as web links instead of inventing
 *   a second, different rule.
 */
import fs from '../../common/fs.js'
import {
  findPathCandidates,
  readLineCells,
  resolveLocalPath
} from './local-path-links.js'

// A pathological line (say, a column of dates with slashes) must not turn into
// hundreds of existence checks on hover.
const maxCandidatesPerLine = 12
const statCacheLimit = 400
const statCacheTtl = 5000

export class LocalPathLinkProvider {
  /**
   * @param {object} options
   * @param {object} options.term - the xterm instance
   * @param {function} options.getCwd - current shell directory (may be '')
   * @param {function} options.openPath - reveals a path in the file manager
   * @param {function} options.shouldActivate - click gate, shared with web links
   * @param {boolean} options.isWin
   * @param {function} [options.statPath] - injectable existence probe
   */
  constructor ({ term, getCwd, openPath, shouldActivate, isWin = false, statPath }) {
    this.term = term
    this.getCwd = getCwd
    this.openPath = openPath
    this.shouldActivate = shouldActivate || (() => true)
    this.isWin = isWin
    this.statPath = statPath || defaultStatPath
    this.cache = new Map()
  }

  /**
   * Does this path exist? Cached for a few seconds: xterm asks again for the
   * same line on every hover, and a local file does not appear or vanish while
   * the pointer sits on it.
   */
  exists (path) {
    const hit = this.cache.get(path)
    if (hit && Date.now() - hit.time < statCacheTtl) {
      return Promise.resolve(hit.exists)
    }
    return this.statPath(path).then(exists => {
      if (this.cache.size >= statCacheLimit) {
        this.cache.clear()
      }
      this.cache.set(path, { exists, time: Date.now() })
      return exists
    })
  }

  provideLinks (bufferLineNumber, callback) {
    const line = this.term?.buffer?.active?.getLine(bufferLineNumber - 1)
    if (!line) {
      return callback(undefined)
    }
    const { text, cells } = readLineCells(line)
    const candidates = findPathCandidates(text, { isWin: this.isWin })
    if (!candidates.length) {
      return callback(undefined)
    }
    const cwd = this.getCwd() || ''
    Promise.all(
      candidates.slice(0, maxCandidatesPerLine).map(candidate => {
        const path = resolveLocalPath(candidate.text, cwd, { isWin: this.isWin })
        if (!path) {
          return Promise.resolve(null)
        }
        return this.exists(path).then(exists => {
          return exists ? { path, candidate } : null
        })
      })
    ).then(list => {
      const links = []
      for (const item of list) {
        if (!item) {
          continue
        }
        const { path, candidate } = item
        const startCell = cells[candidate.start]
        const endCell = cells[candidate.end - 1]
        if (startCell === undefined || endCell === undefined) {
          continue
        }
        links.push({
          range: {
            start: { x: startCell + 1, y: bufferLineNumber },
            end: { x: endCell + 1, y: bufferLineNumber }
          },
          text: candidate.text,
          decorations: {
            pointerCursor: true,
            // no underline: the output of a directory listing is mostly paths,
            // and underlining all of them is noise
            underline: false
          },
          activate: event => {
            // Right click keeps the context menu: xterm calls activate for it
            // too, and the gate below only knows about ctrl/meta.
            if (event?.button === 2) {
              return
            }
            if (!this.shouldActivate(event)) {
              return
            }
            this.openPath(path)
          }
        })
      }
      callback(links.length ? links : undefined)
    }).catch(() => callback(undefined))
  }
}

// statAsync rejects for anything that is not there, which is exactly the answer
// we want; `fs.stat` (the callback wrapper in common/fs.js) is not used because
// it reports an error *and* then dereferences the missing stat object.
function defaultStatPath (path) {
  try {
    if (!fs || typeof fs.statAsync !== 'function') {
      return Promise.resolve(false)
    }
    return Promise.resolve(fs.statAsync(path)).then(() => true, () => false)
  } catch (err) {
    return Promise.resolve(false)
  }
}

export default LocalPathLinkProvider
