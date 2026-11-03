const { describe, test, after } = require('node:test')
const assert = require('node:assert/strict')

// Drives src/client/entry/worker.js with a fake `self` + `WebSocket` and checks
// how it dispatches replies to concurrent calls.
//
// Regression guard: every pending call used to add its own `message` listener
// and JSON.parse the payload inside it, so K concurrent calls parsed every
// incoming message K times (O(K^2)). The sftp file list fires 2 calls per
// directory entry, so a folder with a few thousand entries froze the UI.

const makeFakeWs = () => {
  const listeners = new Set()
  const sent = []
  class FakeWebSocket {
    constructor (url) {
      this.url = url
      setTimeout(() => this.onopen && this.onopen(), 0)
    }

    addEventListener (type, cb) {
      if (type === 'message') {
        listeners.add(cb)
      }
    }

    removeEventListener (type, cb) {
      if (type === 'message') {
        listeners.delete(cb)
      }
    }

    send (data) {
      sent.push(data)
    }

    close () {}
  }
  return { FakeWebSocket, listeners, sent }
}

const setup = () => {
  const { FakeWebSocket, listeners, sent } = makeFakeWs()
  const frames = []
  const fakeSelf = {
    insts: {},
    addEventListener (type, cb) {
      if (type === 'message') {
        fakeSelf.onMsg = cb
      }
    },
    postMessage (data) {
      frames.push(data)
    }
  }
  global.self = fakeSelf
  global.WebSocket = FakeWebSocket
  return { fakeSelf, listeners, sent, frames }
}

const countParses = () => {
  const original = JSON.parse
  let count = 0
  JSON.parse = (...args) => {
    count++
    return original(...args)
  }
  return {
    get count () {
      return count
    },
    restore () {
      JSON.parse = original
    }
  }
}

const delay = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms))

const env = setup()
// one shared worker instance: worker.js is a plain script with module state
require('../../client/entry/worker.js')

const openSocket = async (wsId) => {
  env.fakeSelf.onMsg({
    data: {
      id: wsId,
      action: 'create',
      persist: false,
      type: 'common',
      args: ['common', wsId, '', { host: '127.0.0.1', port: 65535, tokenElecterm: 't' }]
    }
  })
  await delay()
  assert.ok(env.fakeSelf.insts[wsId], 'socket should be registered after open')
}

const register = (wsId, callId) => {
  env.fakeSelf.onMsg({
    data: { action: 'once', wsId, id: callId }
  })
}

const reply = (callId) => {
  const payload = JSON.stringify({ id: callId, data: { ok: callId } })
  for (const listener of [...env.listeners]) {
    listener({ data: payload })
  }
}

const replies = () => env.frames.filter(f => f.action !== 'worker-init')

describe('worker once() dispatch', function () {
  after(function () {
    // node --test gives each file its own process, but do not leave the fake
    // globals behind for anything else running in this one
    delete global.self
    delete global.WebSocket
  })

  test('keeps one message listener for many concurrent calls', async function () {
    const wsId = 'ws-1'
    await openSocket(wsId)
    assert.equal(env.listeners.size, 0, 'no listener while idle')

    const K = 50
    for (let i = 0; i < K; i++) {
      register(wsId, 'call-' + i)
    }
    assert.equal(env.listeners.size, 1, 'one listener for all pending calls')

    for (let i = 0; i < K; i++) {
      reply('call-' + i)
    }
    assert.equal(env.listeners.size, 0, 'listener removed once nothing is pending')
  })

  test('parses each message once, not once per pending call', async function () {
    const wsId = 'ws-2'
    await openSocket(wsId)
    env.frames.length = 0

    const K = 50
    for (let i = 0; i < K; i++) {
      register(wsId, 'p-' + i)
    }

    const spy = countParses()
    try {
      for (let i = 0; i < K; i++) {
        reply('p-' + i)
      }
    } finally {
      spy.restore()
    }
    assert.equal(spy.count, K, 'expected exactly one JSON.parse per message')
  })

  test('delivers each reply to its own caller', async function () {
    const wsId = 'ws-3'
    await openSocket(wsId)
    env.frames.length = 0

    const K = 5
    for (let i = 0; i < K; i++) {
      register(wsId, 'd-' + i)
    }
    for (let i = 0; i < K; i++) {
      reply('d-' + i)
    }
    assert.deepEqual(
      replies().map(f => f.id).sort(),
      ['d-0', 'd-1', 'd-2', 'd-3', 'd-4']
    )
  })

  test('ignores replies nobody waits for', async function () {
    const wsId = 'ws-4'
    await openSocket(wsId)
    register(wsId, 'kept')
    assert.doesNotThrow(() => reply('never-registered'))
    assert.equal(env.listeners.size, 1, 'still waiting for the registered call')
    reply('kept')
    assert.equal(env.listeners.size, 0)
  })

  test('keeps pending calls of different sockets apart', async function () {
    const a = 'ws-5'
    const b = 'ws-6'
    await openSocket(a)
    await openSocket(b)
    register(a, 'only-a')
    register(b, 'only-b')
    // one shared listener per socket, not one for the pair
    assert.equal(env.listeners.size, 2)
    env.frames.length = 0
    reply('only-b')
    assert.deepEqual(replies().map(f => [f.wsId, f.id]), [[b, 'only-b']])
    assert.equal(env.listeners.size, 1, 'the other socket still waits')
    reply('only-a')
    assert.deepEqual(replies().map(f => [f.wsId, f.id]), [[b, 'only-b'], [a, 'only-a']])
  })

  test('coexists with a persistent listener on the same socket', async function () {
    // transfer/upgrade sockets keep an `addEventListener` cb for data frames
    // while once() calls are pending: both have to keep working
    const wsId = 'ws-7'
    await openSocket(wsId)
    env.fakeSelf.onMsg({
      data: { action: 'addEventListener', wsId, id: 'sub', type: 'message' }
    })
    assert.equal(env.listeners.size, 1)
    register(wsId, 'once-1')
    assert.equal(env.listeners.size, 2, 'persistent + shared once listener')
    env.frames.length = 0

    reply('once-1')
    assert.equal(env.listeners.size, 1, 'once listener gone, persistent stays')

    // the persistent cb sees every frame, replies to once() calls included, so
    // start counting after the reply has been through
    env.frames.length = 0
    const dataFrame = JSON.stringify({ id: 'sub', data: 'chunk' })
    for (const listener of [...env.listeners]) {
      listener({ data: dataFrame })
    }
    assert.equal(
      env.frames.filter(f => f.id === 'sub').length,
      1,
      'persistent listener still delivers its frames'
    )
  })
})
