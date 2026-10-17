// Watches one terminal's output for text, for wait steps in quick commands.
//
// Only output that arrives after the last mark() counts, and mark() is
// called each time a step is sent, so a wait step never matches the prompt
// that was already on screen. Text is matched without colors and without
// regard to case. A match uses up the output up to its end, so two wait
// steps in a row need two separate matches.
import { stripAnsi, normalizeCR } from './strip-ansi.js'

const maxBuffer = 65536

export function createOutputWatch () {
  let buf = ''
  const watchers = new Set()

  function scan () {
    for (const w of [...watchers]) {
      const at = buf.toLowerCase().indexOf(w.text)
      if (at < 0) {
        continue
      }
      watchers.delete(w)
      buf = buf.slice(at + w.text.length)
      w.resolve()
    }
  }

  return {
    push (str) {
      if (!str) {
        return
      }
      buf += normalizeCR(stripAnsi(str))
      if (buf.length > maxBuffer) {
        buf = buf.slice(-maxBuffer)
      }
      scan()
    },
    mark () {
      buf = ''
    },
    // resolves when the text shows up, cancel() drops the watch
    watch (text) {
      const w = { text: normalizeCR(String(text || '')).toLowerCase() }
      const found = new Promise(resolve => {
        w.resolve = resolve
      })
      watchers.add(w)
      scan()
      return {
        found,
        cancel () {
          watchers.delete(w)
        }
      }
    }
  }
}
