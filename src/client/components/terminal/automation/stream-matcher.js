// Incremental stream matcher: keeps a sliding-window tail buffer and
// re-matches on every push so patterns split across chunks still hit.
import { toSafeRegExp } from './keys.js'

export default class StreamMatcher {
  constructor ({ maxBuffer = 65536 } = {}) {
    this.buf = ''
    this.base = 0
    this.maxBuffer = maxBuffer
    this.watchers = new Set()
  }

  push (str) {
    if (!str) {
      return
    }
    this.buf += str
    const over = this.buf.length - this.maxBuffer
    if (over > 0) {
      this.buf = this.buf.slice(over)
      this.base += over
    }
    this._scan()
  }

  _scan () {
    for (const w of [...this.watchers]) {
      const m = w.re.exec(this.buf)
      if (!m) {
        continue
      }
      this.watchers.delete(w)
      clearTimeout(w.timer)
      w.resolve({
        index: this.base + m.index,
        text: m[0],
        groups: m.slice(1),
        before: this.buf.slice(Math.max(0, w.from - this.base), m.index)
      })
      if (w.consume) {
        const cut = m.index + m[0].length
        this.base += cut
        this.buf = this.buf.slice(cut)
      }
    }
  }

  wait (re, { timeout = 10000, consume = true, from = null } = {}) {
    return new Promise((resolve, reject) => {
      const w = {
        re: toSafeRegExp(re),
        resolve,
        reject,
        consume,
        from: from == null ? this.base + this.buf.length : from,
        timer: null
      }
      if (timeout > 0) {
        w.timer = setTimeout(() => {
          this.watchers.delete(w)
          const err = new Error('waitFor timeout: ' + re)
          err.code = 'ETIMEOUT'
          err.tail = this.buf.slice(-4096)
          reject(err)
        }, timeout)
      }
      this.watchers.add(w)
      this._scan()
    })
  }

  dispose () {
    for (const w of this.watchers) {
      clearTimeout(w.timer)
      const err = new Error('matcher disposed')
      err.code = 'EDISPOSED'
      w.reject?.(err)
    }
    this.watchers.clear()
    this.buf = ''
  }
}
