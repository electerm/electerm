/**
 * bytes to send from the serial "send raw bytes" input (session toolbar)
 * hex: `1B 41 0d`, `0x1b,0x41`, `1B410D` / dec: `27 65 13` / bin: `00011011`
 * ascii: text with \r \n \t \\ \xHH escapes
 */

const bases = { hex: 16, dec: 10, bin: 2 }
const digits = { hex: /^[0-9a-f]+$/i, dec: /^[0-9]+$/, bin: /^[01]+$/ }

/**
 * @param {string} text
 * @param {'hex'|'dec'|'bin'|'ascii'} format
 * @return {number[]} bytes
 * @throws on invalid input
 */
export function parseSerialInput (text, format) {
  if (format === 'ascii') {
    const s = text.replace(/\\(x[0-9a-fA-F]{2}|[rnt\\])/g, (m, c) => {
      const map = { r: '\r', n: '\n', t: '\t', '\\': '\\' }
      return map[c] ?? String.fromCharCode(parseInt(c.slice(1), 16))
    })
    return [...s].map(c => {
      const b = c.charCodeAt(0)
      if (b > 255) {
        throw new Error(`not a byte: ${c}`)
      }
      return b
    })
  }
  const base = bases[format]
  const res = []
  for (let t of text.trim().split(/[\s,;]+/).filter(Boolean)) {
    if (format === 'hex') {
      t = t.replace(/^0x/i, '')
    } else if (format === 'bin') {
      t = t.replace(/^0b/i, '')
    }
    if (!digits[format].test(t)) {
      throw new Error(`invalid ${format}: ${t}`)
    }
    if (format === 'hex' && t.length > 2 && t.length % 2) {
      throw new Error(`odd number of hex digits: ${t}`)
    }
    // hex without separators: 1B410D
    const parts = format === 'hex' && t.length > 2
      ? t.match(/.{1,2}/g)
      : [t]
    for (const p of parts) {
      const b = parseInt(p, base)
      if (b > 255) {
        throw new Error(`not a byte: ${p}`)
      }
      res.push(b)
    }
  }
  return res
}
