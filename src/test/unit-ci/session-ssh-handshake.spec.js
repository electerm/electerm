process.env.NODE_ENV = 'development'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const { handshake } = require('../../app/server/session-ssh/handshake')
const { utils } = require('@electerm/ssh2')

// Drive ssh2's event order directly: a real TCP connection cannot guarantee
// that the close falls between a known_hosts read and the ensuing prompt.
function startHandshake (ask) {
  const aborted = []
  const session = {
    initOptions: {},
    prompts: { ask, abort: conn => aborted.push(conn) }
  }
  const conn = new EventEmitter()
  let options
  conn.connect = opts => { options = opts }
  const ready = handshake(session, conn, {}, { host: 'fixture.invalid' }, {})
  return { aborted, conn, options, ready }
}

test('a clean close before ready rejects even when no prompt is outstanding', async () => {
  const { conn, ready, aborted } = startHandshake(assert.fail)
  conn.emit('close')
  await assert.rejects(ready, /closed before it was ready/)
  assert.deepEqual(aborted, [conn])
})

test('a host-key lookup finishing after close cannot open a stale trust prompt', async t => {
  t.mock.method(fs.promises, 'readFile', async () => '')
  const ask = t.mock.fn(async () => [])
  const { conn, options, ready } = startHandshake(ask)
  const key = utils.parseKey(utils.generateKeyPairSync('ed25519').private).getPublicSSH()
  const verified = new Promise(resolve => options.hostVerifier(key, resolve))
  conn.emit('close')
  await assert.rejects(ready, /closed before it was ready/)
  assert.equal(await verified, false)
  assert.equal(ask.mock.callCount(), 0)
})

test('a late keyboard-interactive reply cannot answer on a closed transport', async t => {
  let answer
  const { conn, ready } = startHandshake(() => new Promise(resolve => { answer = resolve }))
  const finish = t.mock.fn()
  conn.emit('keyboard-interactive', 'MFA', '', '', [{ prompt: 'OTP:', echo: false }], finish)
  conn.emit('close')
  answer(['123456'])
  await assert.rejects(ready, /closed before it was ready/)
  assert.equal(finish.mock.callCount(), 0)
})
