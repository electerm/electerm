// session-serial -> log -> runtime-constants requires ../package.json unless
// isDev, and that file only exists in a packaged app. See rdp-errors.spec.js.
process.env.NODE_ENV = 'development'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { TerminalSerial } = require('../../app/server/session-serial')
const { SerialView } = require('../../app/server/serial-view')

// no init(): no serial port is opened, the port is a stub with the two calls
// serialEvent makes (set / get) plus write for the raw send
function setup () {
  const sets = []
  const writes = []
  const port = {
    set (opts, cb) {
      sets.push({ ...opts })
      cb && cb()
    },
    get (cb) {
      cb(null, { cts: true, dsr: false, dcd: true })
    },
    write (data) {
      writes.push(data)
    }
  }
  const term = new TerminalSerial({ path: '/dev/null', uid: 'test' }, null, true)
  term.port = port
  term.view = new SerialView({ rows: 24 })
  term.signals = { dtr: true, rts: true, brk: false }
  term.framer = null
  term.rxConverter = null
  term.rxLineEnding = 'none'
  term.txLineEnding = '\r'
  const ui = []
  const data = []
  term._wsUiHandler = buf => ui.push(buf)
  term._wsDataHandler = buf => data.push(buf)
  const sent = []
  const ws = {
    readyState: 1,
    s: msg => sent.push(msg)
  }
  return { term, ws, sets, writes, ui, data, sent }
}

const isAsciiRedraw = buf => Buffer.isBuffer(buf) &&
  buf.toString('latin1').startsWith('\x1b[H\x1b[2J')

describe('serial event', () => {
  test('set dtr / rts: the port gets all three, the reply has the status lines', async () => {
    const { term, ws, sets, sent } = setup()
    await term.serialEvent({ cmd: 'set', dtr: false }, ws)
    assert.deepEqual(sets.at(-1), { dtr: false, rts: true, brk: false })
    assert.equal(sent.length, 1)
    const reply = sent[0]
    assert.equal(reply.action, 'serial-event')
    assert.equal(reply.dtr, false)
    assert.equal(reply.rts, true)
    assert.equal(reply.cts, true)
    assert.equal(reply.dsr, false)
    assert.equal(reply.dcd, true)
    assert.equal(reply.mode, 'ascii')
    assert.equal(reply.error, undefined)
  })

  test('a failed set is reported, not thrown', async () => {
    const { term, ws, sent } = setup()
    term.port.set = (opts, cb) => cb(new Error('rts is owned by rtscts'))
    await term.serialEvent({ cmd: 'set', rts: false }, ws)
    assert.equal(sent[0].error, 'rts is owned by rtscts')
    assert.equal(sent[0].rts, false)
  })

  test('break is a pulse: on, then off again by itself', async () => {
    const { term, ws, sets, sent } = setup()
    await term.serialEvent({ cmd: 'set', brk: true }, ws)
    assert.equal(sets[0].brk, true)
    // the toolbar never sees it lit: holding the line low is not a state
    assert.equal(sent[0].brk, false)
    assert.equal(term.signals.brk, true)
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.equal(sets.at(-1).brk, false)
    assert.equal(term.signals.brk, false)
    clearTimeout(term._breakTimer)
  })

  test('send drops what is not a byte and bypasses txLineEnding', async () => {
    const { term, ws, writes } = setup()
    await term.serialEvent({ cmd: 'send', data: [0x41, 999, 'x', 1.5, 0] }, ws)
    assert.deepEqual([...writes.at(-1)], [0x41, 0])
  })

  test('a view change is drawn as ui output, not as session output', async () => {
    const { term, ws, ui, data } = setup()
    term.port.on = () => {}
    term.view.record(Buffer.from('AB'))
    await term.serialEvent({ cmd: 'view', mode: 'hex', ascii: false }, ws)
    assert.equal(data.length, 0, 'not into the log / zmodem path')
    assert.ok(ui.some(isAsciiRedraw), 'redraw on a cleared screen')
    assert.ok(ui.at(-1).toString('latin1').includes('41 42'))
  })

  test('a closed socket is not written to', async () => {
    const { term, ws, sent } = setup()
    ws.readyState = 3
    await term.serialEvent({ cmd: 'get' }, ws)
    assert.equal(sent.length, 0)
  })
})
