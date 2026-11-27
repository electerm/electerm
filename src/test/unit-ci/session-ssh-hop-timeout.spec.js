process.env.NODE_ENV = 'development'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { performance } = require('node:perf_hooks')
const { setImmediate: nextTurn } = require('node:timers/promises')
const { connectHops } = require('../../app/server/session-ssh/hops')
const { commonExtends } = require('../../app/server/session-common')

const authError = 'All configured authentication methods failed'

function fixture (t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  t.mock.method(performance, 'now', () => Date.now())
  const upstream = {
    exec: t.mock.fn(),
    sftp: t.mock.fn(),
    forwardOut: t.mock.fn((src, port, host, dest, cb) => cb(new Error(authError)))
  }
  class Session {}
  const session = new (commonExtends(Session))()
  session.conn = upstream
  session.initOptions = { useSshAgent: false }
  session.prompts = { ask: async () => [''] }
  let connectionError
  connectHops(session, [{ host: 'destination', username: 'tester' }]).catch(err => {
    connectionError = err
  })
  async function failure () {
    await nextTurn()
    assert.ok(connectionError instanceof Error, 'discovery should have finished by this time')
    return connectionError
  }
  return { upstream, failure, tick: ms => t.mock.timers.tick(ms) }
}

function channel (t) {
  const stream = new EventEmitter()
  stream.stderr = new EventEmitter()
  stream.close = t.mock.fn(() => stream.emit('close'))
  return stream
}

function reply (method, ...args) {
  method.mock.calls.at(-1).arguments.at(-1)(...args)
}

test('time spent opening the listing channel counts toward its execution deadline', async t => {
  const { upstream, tick, failure } = fixture(t)
  await nextTurn()
  tick(12000)
  const stream = channel(t)
  reply(upstream.exec, null, stream)
  tick(2999)
  assert.equal(stream.close.mock.callCount(), 0)
  tick(1)
  const err = await failure()
  assert.match(err.message, /sh: jump-host key discovery timed out/)
  assert.doesNotMatch(err.message, /SFTP/)
  assert.equal(stream.close.mock.callCount(), 1)
  assert.equal(upstream.sftp.mock.callCount(), 0)
})

test('a shell channel arriving after discovery gave up is closed', async t => {
  const { upstream, tick, failure } = fixture(t)
  await nextTurn()
  tick(15000)
  assert.match((await failure()).message, /discovery timed out/)
  const late = channel(t)
  reply(upstream.exec, null, late)
  assert.equal(late.close.mock.callCount(), 1)
  assert.equal(upstream.sftp.mock.callCount(), 0)
})

test('a later shell read timing out preserves an earlier candidate and skips SFTP', async t => {
  const { upstream, tick, failure } = fixture(t)
  await nextTurn()
  tick(5000)
  const listing = channel(t)
  reply(upstream.exec, null, listing)
  listing.emit('data', Buffer.from('a.pub\0b.pub\0c.pub\0'))
  listing.emit('close')
  await nextTurn()
  tick(4000)
  const firstKey = channel(t)
  reply(upstream.exec, null, firstKey)
  firstKey.emit('data', Buffer.from('first key'))
  firstKey.emit('close')
  await nextTurn()
  tick(6000)
  assert.equal((await failure()).message, authError)
  assert.equal(upstream.exec.mock.callCount(), 3)
  assert.equal(upstream.sftp.mock.callCount(), 0)
})

test('SFTP setup gets the time left by the shell, and closes a late subsystem', async t => {
  const { upstream, tick, failure } = fixture(t)
  await nextTurn()
  tick(11000)
  reply(upstream.exec, new Error('shell unavailable'))
  await nextTurn()
  assert.equal(upstream.sftp.mock.callCount(), 1)
  tick(4000)
  const err = await failure()
  assert.match(err.message, /sh: shell unavailable, SFTP: jump-host key discovery timed out/)
  const late = { end: t.mock.fn() }
  reply(upstream.sftp, null, late)
  assert.equal(late.end.mock.callCount(), 1)
})

test('listing and reads share the budget while destination authentication is excluded', async t => {
  const { upstream, tick, failure } = fixture(t)
  // Hold the first destination attempt while the candidate generator is paused.
  upstream.forwardOut.mock.mockImplementationOnce(() => {})
  await nextTurn()
  tick(3000)
  const listing = channel(t)
  reply(upstream.exec, null, listing)
  tick(1000)
  listing.emit('exit', 127)
  listing.emit('close')
  await nextTurn()

  tick(3000)
  const sftp = { readdir: t.mock.fn(), readFile: t.mock.fn(), end: t.mock.fn() }
  reply(upstream.sftp, null, sftp)
  await nextTurn()
  tick(3000)
  reply(sftp.readdir, null, ['a.pub', 'b.pub', 'c.pub'].map(filename => ({ filename })))
  await nextTurn()
  tick(1000)
  reply(sftp.readFile, null, 'first key')
  await nextTurn()
  assert.equal(upstream.forwardOut.mock.callCount(), 1)
  tick(60000)
  reply(upstream.forwardOut, new Error(authError))
  await nextTurn()

  const reads = () => sftp.readFile.mock.calls.map(call => call.arguments[0])
  assert.deepEqual(reads(), ['.ssh/a', '.ssh/b'])
  tick(3999)
  assert.equal(sftp.end.mock.callCount(), 0)
  tick(1)
  // One key was found and tried. A later read timeout leaves the destination's
  // authentication error intact, and the third key is never requested.
  assert.equal((await failure()).message, authError)
  assert.deepEqual(reads(), ['.ssh/a', '.ssh/b'])
  assert.equal(sftp.end.mock.callCount(), 1)
  reply(sftp.readFile, null, 'late second key')
  assert.equal(upstream.forwardOut.mock.callCount(), 2)
})
