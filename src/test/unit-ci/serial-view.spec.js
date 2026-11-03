const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { SerialView, createFramer } = require('../../app/server/serial-view')

let parseSerialInput

before(async () => {
  const mod = await import('../../client/common/serial-input.js')
  parseSerialInput = mod.parseSerialInput
})

describe('serial view', () => {
  const rx = (v, data) => {
    const buf = Buffer.from(data)
    v.record(buf)
    return v.format(buf)
  }

  test('ascii mode passes data through', () => {
    const v = new SerialView()
    assert.equal(rx(v, 'hi'), null)
  })

  test('hex lines of 16 with ascii column, last line redrawn', () => {
    const v = new SerialView()
    assert.equal(v.set({ mode: 'hex' }), true)
    assert.equal(v.set({ mode: 'hex' }), false)
    const first = rx(v, 'AB\r')
    assert.equal(first, '\r\x1b[K' + '41 42 0D'.padEnd(47) + '  AB.')
    const next = rx(v, '0123456789abcdefZ')
    const lines = next.split('\r\n')
    assert.equal(lines.length, 2)
    assert.ok(lines[0].startsWith('\r\x1b[K41 42 0D 30 31'))
    assert.ok(lines[0].endsWith('  AB.0123456789abc'))
    assert.equal(lines[1], '64 65 66 5A'.padEnd(47) + '  defZ')
  })

  test('dec and bin cells, ascii column off', () => {
    const v = new SerialView()
    v.set({ mode: 'dec', ascii: false })
    assert.equal(rx(v, [7, 65, 255]), '\r\x1b[K  7  65 255')
    v.set({ mode: 'bin' })
    assert.equal(v.screen(), '00000111 01000001 11111111')
    assert.equal(rx(v, [5]), '\r\x1b[K00000111 01000001 11111111 00000101')
    assert.equal(v.set({ mode: 'nonsense' }), false)
    assert.equal(v.mode, 'bin')
  })

  test('a change of the view redraws what came in before', () => {
    const v = new SerialView()
    rx(v, 'hello\r\n')
    assert.equal(v.set({ mode: 'hex', ascii: false }), true)
    assert.equal(v.screen(), '68 65 6C 6C 6F 0D 0A')
    rx(v, Buffer.alloc(9, 0x41))
    assert.equal(v.screen(), '68 65 6C 6C 6F 0D 0A 41 41 41 41 41 41 41 41 41\r\n')
  })

  test('arrow keys move a byte cursor, marked in both columns', () => {
    const v = new SerialView()
    rx(v, '0123456789abcdefXY')
    assert.equal(v.move('\x1b[D'), null, 'ascii mode: keys go to the port')
    v.set({ mode: 'hex' })
    assert.equal(v.move('a'), null)
    // first key: last byte, on the terminal's current row
    let out = v.move('\x1b[D')
    assert.deepEqual(v.cursorInfo(), { offset: 17, byte: 0x59 })
    assert.ok(out.startsWith('\x1b7\r\x1b[K58 \x1b[7m59\x1b[27m'))
    assert.ok(out.endsWith('X\x1b[7mY\x1b[27m\x1b8'))
    // up into the first line: both lines redrawn, the old one unmarked
    out = v.move('\x1bOA')
    assert.deepEqual(v.cursorInfo(), { offset: 1, byte: 0x31 })
    assert.ok(out.includes('\x1b[1A\r\x1b[K30 \x1b[7m31\x1b[27m 32'))
    assert.ok(out.includes('  0\x1b[7m1\x1b[27m23'))
    assert.ok(out.includes('\r\x1b[K58 59'))
    assert.equal(v.move('\x1b[A'), '', 'no line above')
    v.move('\x1b[D')
    assert.equal(v.move('\x1b[D'), '', 'first byte')
    assert.equal(v.cursorInfo().offset, 0)
    // the cursor stays on its byte when the view changes
    v.set({ mode: 'bin', ascii: false })
    assert.ok(v.screen().startsWith('\x1b[7m00110000\x1b[27m 00110001'))
    v.set({ mode: 'ascii' })
    assert.equal(v.cursorInfo(), null)
  })

  test('the cursor stays on the lines on screen', () => {
    const v = new SerialView({ rows: 2 })
    v.set({ mode: 'hex' })
    rx(v, Buffer.alloc(40, 0x41))
    v.move('\x1b[A')
    assert.equal(v.cursorInfo().offset, 39)
    v.move('\x1b[A')
    assert.equal(v.cursorInfo().offset, 23)
    assert.equal(v.move('\x1b[A'), '', 'line 0 is off screen')
  })
})

describe('serial frame bytes', () => {
  const rx = (v, data) => {
    const buf = Buffer.from(data)
    v.record(buf)
    return v.format(buf)
  }

  test('hex view: a line begins at the start byte and after the stop byte', () => {
    const v = new SerialView()
    rx(v, [1, 2, 0x10, 3, 0xff, 0x10, 4, 0xff, 5])
    assert.equal(v.set({ mode: 'hex', ascii: false, start: 0x10, stop: 0xff }), true)
    assert.equal(v.screen(), ['01 02', '10 03 FF', '10 04 FF', '05'].join('\r\n'))
    // a frame that ends with a full line: no empty frame line in between
    rx(v, [0xff, 0x10, ...Array(16).fill(0x41), 0xff])
    assert.deepEqual(v.screen().split('\r\n').slice(3), [
      '05 FF', '10 ' + '41 '.repeat(15).trim(), '41 FF', ''
    ])
    assert.equal(v.set({ start: null, stop: null }), true)
    assert.equal(v.screen().split('\r\n')[0], '01 02 10 03 FF 10 04 FF 05 FF 10 41 41 41 41 41')
    assert.equal(v.set({ start: 300 }), false, 'not a byte')
  })

  test('cursor up / down over lines of different length', () => {
    const v = new SerialView()
    v.set({ mode: 'hex', start: 0x10 })
    rx(v, [1, 2, 3, 4, 0x10, 5, 0x10, 6, 7, 8])
    v.move('\x1b[A')
    assert.equal(v.cursorInfo().offset, 9)
    v.move('\x1b[A')
    assert.equal(v.cursorInfo().offset, 5, 'last byte of the shorter line')
    v.move('\x1b[A')
    assert.equal(v.cursorInfo().offset, 1)
    v.move('\x1b[B')
    assert.equal(v.cursorInfo().offset, 5)
  })

  test('ascii view: line breaks unless the data has them', () => {
    const f = createFramer(0x10, 0xff)
    assert.equal(f('a\x10b\xff'), 'a\r\n\x10b\xff')
    assert.equal(f('c'), '\r\nc', 'after the stop byte, once more data comes')
    assert.equal(f('\xff\r\n\x10d'), '\xff\r\n\x10d', 'the device ends the line itself')
    assert.equal(createFramer(null, 0x0a)('x\ny'), 'x\ny')
  })

  test('kept bytes are cut at a line start', () => {
    const v = new SerialView()
    v.set({ mode: 'bin', ascii: false, start: 0x10 })
    const frame = Buffer.from([0x10, 1, 2])
    for (let i = 0; i < 150000; i++) {
      v.record(frame)
    }
    assert.ok(v.base > 0, 'cut')
    assert.ok(v.bytes.length <= 320 * 1024)
    assert.equal(v.bytes[0], 0x10)
    assert.equal(v.starts[0], v.base)
    assert.ok(v.screen().startsWith('00010000 00000001 00000010\r\n'))
  })
})

describe('serial input', () => {
  test('hex variants', () => {
    assert.deepEqual(parseSerialInput('1B 41 0d', 'hex'), [0x1b, 0x41, 0x0d])
    assert.deepEqual(parseSerialInput('0x1b,0x41;0D', 'hex'), [0x1b, 0x41, 0x0d])
    assert.deepEqual(parseSerialInput('1B410D', 'hex'), [0x1b, 0x41, 0x0d])
    assert.deepEqual(parseSerialInput('a', 'hex'), [0x0a])
    assert.throws(() => parseSerialInput('1B4', 'hex'), /odd/)
    assert.throws(() => parseSerialInput('zz', 'hex'), /invalid/)
  })

  test('dec, bin, ascii', () => {
    assert.deepEqual(parseSerialInput('27 65 13', 'dec'), [27, 65, 13])
    assert.throws(() => parseSerialInput('256', 'dec'), /not a byte/)
    assert.deepEqual(parseSerialInput('0b101 11111111', 'bin'), [5, 255])
    assert.deepEqual(parseSerialInput('AT\\r\\n\\x1b\\\\', 'ascii'), [65, 84, 13, 10, 27, 92])
    assert.deepEqual(parseSerialInput('ä', 'ascii'), [0xe4])
    assert.throws(() => parseSerialInput('€', 'ascii'), /not a byte/)
  })
})
