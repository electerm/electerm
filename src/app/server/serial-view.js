/**
 * serial rx display as hex / dec / bin columns (like hterm), optionally
 * with an ascii column. Keeps the received bytes, so a change of the view
 * redraws what came in so far, and a byte cursor (arrow keys) marks a byte
 * in both columns.
 *
 * A line holds up to 16 bytes (8 for bin). With a frame start byte a new
 * line begins at that byte, with a frame stop byte after it. The unfinished
 * last line is the row the terminal cursor is on and is redrawn with every
 * chunk.
 */

const cells = {
  hex: b => b.toString(16).toUpperCase().padStart(2, '0'),
  dec: b => String(b).padStart(3, ' '),
  bin: b => b.toString(2).padStart(8, '0')
}
const widths = { hex: 16, dec: 16, bin: 8 }
// bytes kept: cut down to MAX_KEEP once there are a quarter more
const MAX_KEEP = 256 * 1024
const CUT_AT = MAX_KEEP * 1.25
const MARK = '\x1b[7m'
const UNMARK = '\x1b[27m'
// cursor keys, normal (ESC [ A) and application mode (ESC O A)
const MOVES = { A: 'up', B: 'down', C: 'right', D: 'left' }
const cursorKey = key => key.length === 3 && key[0] === '\x1b' &&
  (key[1] === '[' || key[1] === 'O') && MOVES[key[2]]

const printable = b => b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'
const isByte = v => Number.isInteger(v) && v >= 0 && v <= 255

/**
 * ascii view with frame bytes: a line break before the start byte and after
 * the stop byte, unless the data has one there already
 * @param {number|null} start
 * @param {number|null} stop
 * @return {(str: string) => string} stateful, latin1 strings
 */
function createFramer (start, stop) {
  const startCh = start === null ? null : String.fromCharCode(start)
  const stopCh = stop === null ? null : String.fromCharCode(stop)
  let lineStart = true
  let pending = false
  return str => {
    let out = ''
    for (const ch of str) {
      const eol = ch === '\r' || ch === '\n'
      if (pending && !eol) {
        out += '\r\n'
        lineStart = true
      }
      pending = false
      if (ch === startCh && !lineStart) {
        out += '\r\n'
      }
      out += ch
      lineStart = ch === '\n'
      if (ch === stopCh && !lineStart) {
        pending = true
      }
    }
    return out
  }
}

class SerialView {
  constructor ({ rows = 24 } = {}) {
    this.mode = 'ascii'
    this.ascii = true
    this.start = null
    this.stop = null
    this.rows = rows
    // received bytes in buf[0 .. size), buf[0] is byte number base of
    // the session; buf grows by doubling
    this.buf = Buffer.alloc(4096)
    this.size = 0
    this.base = 0
    // byte number under the cursor, null: no cursor yet
    this.cursor = null
    this.layout()
  }

  get bytes () {
    return this.buf.subarray(0, this.size)
  }

  get end () {
    return this.base + this.size
  }

  get width () {
    return widths[this.mode]
  }

  // line starts (byte numbers) of all kept bytes in hex / dec / bin view
  layout () {
    this.starts = [this.base]
    if (this.mode !== 'ascii') {
      this.extend(this.base)
    }
  }

  extend (from) {
    const { starts, width, start, stop } = this
    for (let n = from; n < this.end; n++) {
      const b = this.buf[n - this.base]
      const lineStart = starts[starts.length - 1]
      if (b === start && n > lineStart) {
        starts.push(n)
      }
      const len = n + 1 - starts[starts.length - 1]
      if (b === stop || len === width) {
        starts.push(n + 1)
      }
    }
  }

  /**
   * keep received bytes, in every mode
   * @param {Buffer|string} data
   */
  record (data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'latin1')
    const from = this.end
    if (this.size + buf.length > this.buf.length) {
      const grown = Buffer.alloc(Math.max(this.buf.length * 2, this.size + buf.length))
      this.buf.copy(grown, 0, 0, this.size)
      this.buf = grown
    }
    buf.copy(this.buf, this.size)
    this.size += buf.length
    if (this.mode !== 'ascii') {
      this.extend(from)
    }
    if (this.size > CUT_AT) {
      // cut at a line start, so the lines stay as they are
      const min = this.end - MAX_KEEP
      const cut = this.starts.find(s => s >= min) ?? min
      this.buf.copy(this.buf, 0, cut - this.base, this.size)
      this.size -= cut - this.base
      this.base = cut
      this.starts = this.starts.filter(s => s >= cut)
      if (this.starts[0] !== cut) {
        this.starts.unshift(cut)
      }
      if (this.cursor !== null && this.cursor < this.base) {
        this.cursor = this.base
      }
    }
  }

  /**
   * @param {{mode?: string, ascii?: boolean, start?: number|null, stop?: number|null}} opts
   * @return {boolean} the view changed: redraw with screen()
   */
  set (opts) {
    const { mode, ascii } = opts
    const before = [this.mode, this.ascii, this.start, this.stop].join()
    if (mode === 'ascii' || cells[mode]) {
      this.mode = mode
    }
    if (typeof ascii === 'boolean') {
      this.ascii = ascii
    }
    for (const k of ['start', 'stop']) {
      if (k in opts && (opts[k] === null || isByte(opts[k]))) {
        this[k] = opts[k]
      }
    }
    const changed = before !== [this.mode, this.ascii, this.start, this.stop].join()
    if (changed) {
      this.layout()
    }
    return changed
  }

  // ascii view: line breaks at the frame bytes, null: none set
  framer () {
    return this.start === null && this.stop === null
      ? null
      : createFramer(this.start, this.stop)
  }

  get lastLine () {
    return this.starts.length - 1
  }

  lineOf (n) {
    const { starts } = this
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= n) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    return lo
  }

  lineEnd (line) {
    return line < this.lastLine ? this.starts[line + 1] : this.end
  }

  render (line) {
    const w = this.width
    const cell = cells[this.mode]
    const first = this.starts[line]
    const bytes = [...this.bytes.subarray(first - this.base, this.lineEnd(line) - this.base)]
    const mark = this.cursor === null ? -1 : this.cursor - first
    const marked = (s, i) => i === mark ? MARK + s + UNMARK : s
    let s = bytes.map((b, i) => marked(cell(b), i)).join(' ')
    if (this.ascii) {
      const cw = cell(0).length + 1
      const pad = w * cw - 1 - (bytes.length ? bytes.length * cw - 1 : 0)
      s += ' '.repeat(pad) + '  ' + bytes.map((b, i) => marked(printable(b), i)).join('')
    }
    return s
  }

  lines (from, to) {
    const out = []
    for (let l = Math.max(from, 0); l <= to; l++) {
      out.push(this.render(l))
    }
    return out.join('\r\n')
  }

  /**
   * all kept bytes in the current mode, after the terminal was cleared
   * @return {string}
   */
  screen () {
    return this.lines(0, this.lastLine)
  }

  /**
   * @param {Buffer|string} data received bytes, already record()ed
   * @return {string | null} null: ascii mode, show data as it is
   */
  format (data) {
    if (this.mode === 'ascii') {
      return null
    }
    const start = this.end - data.length
    return '\r\x1b[K' + this.lines(this.lineOf(start), this.lastLine)
  }

  /**
   * arrow keys move the byte cursor in hex / dec / bin mode, within the
   * lines on screen; the first key puts it on the last byte
   * @param {string} key typed input
   * @return {string | null} null: not a cursor key, send it to the port;
   *   else what to write to the terminal
   */
  move (key) {
    const dir = cursorKey(key)
    if (this.mode === 'ascii' || !dir) {
      return null
    }
    if (!this.bytes.length) {
      return ''
    }
    const old = this.cursor
    const top = Math.max(0, this.lastLine - this.rows + 1)
    const min = this.starts[top]
    let next
    if (old === null || old < min || old >= this.end) {
      next = this.end - 1
    } else if (dir === 'left' || dir === 'right') {
      next = old + (dir === 'left' ? -1 : 1)
    } else {
      // same column in the line above / below, or its last byte
      const line = this.lineOf(old)
      const to = line + (dir === 'up' ? -1 : 1)
      if (to < top || to > this.lastLine || this.lineEnd(to) === this.starts[to]) {
        return ''
      }
      next = Math.min(this.starts[to] + old - this.starts[line], this.lineEnd(to) - 1)
    }
    if (next < min || next > this.end - 1) {
      return ''
    }
    this.cursor = next
    const redraw = new Set(
      [old, next]
        .filter(n => n !== null && n >= min && n < this.end)
        .map(n => this.lineOf(n))
    )
    let out = ''
    for (const line of redraw) {
      const up = this.lastLine - line
      out += '\x1b7' + (up ? `\x1b[${up}A` : '') + '\r\x1b[K' + this.render(line) + '\x1b8'
    }
    return out
  }

  /**
   * @return {{offset: number, byte: number} | null} the byte under the cursor
   */
  cursorInfo () {
    if (this.mode === 'ascii' || this.cursor === null || this.cursor >= this.end) {
      return null
    }
    return { offset: this.cursor, byte: this.bytes[this.cursor - this.base] }
  }
}

module.exports = { SerialView, createFramer }
