const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

// Drives src/client/common/transfer.js against a fake worker, the way
// src/test/unit-ci/worker-once-dispatch.spec.js drives the worker itself.
//
// Regression guard for electerm-web#31: a transfer socket is not persistent,
// and the server destroys the transfer as soon as it closes, so a dropped
// websocket used to leave the page with a pending `transfer:end`/`transfer:err`
// entry that clearOnces() simply deleted -- no end, no error, and a panel row
// that showed a percentage forever. transfer.js now passes the `onClose`
// callback that ws.once() already offered.
//
// The other half of the guard: the three deliberate teardowns (end, err,
// destroy/cancel) close the socket themselves, so a naive onClose would report
// "connection lost" after every successful transfer and every cancel.

const frames = []
let deliver = () => {}

global.window = {
  pre: { transferKeys: ['pause', 'resume', 'destroy'] },
  store: { config: {} },
  worker: {
    addEventListener (type, cb) {
      if (type === 'message') {
        deliver = cb
      }
    },
    postMessage (data) {
      frames.push(data)
    }
  }
}

let createTransfer

before(async () => {
  const mod = await import('../../client/common/transfer.js')
  createTransfer = mod.default
})

// Opens a transfer and answers the worker's `create` frame, which is what the
// real worker sends once the websocket is up.
const start = async () => {
  frames.length = 0
  const events = { data: [], end: [], error: [] }
  const promise = createTransfer({
    sftpId: 'sftp-1',
    isFtp: false,
    type: 'download',
    remotePath: '/remote/big.iso',
    localPath: '/tmp/big.iso',
    onData: d => events.data.push(d),
    onEnd: a => events.end.push(a),
    onError: e => events.error.push(e)
  })
  const create = frames.find(f => f.action === 'create')
  assert.ok(create, 'the transfer should open a transfer socket')
  deliver({ data: { id: create.id, action: 'create' } })
  const transfer = await promise
  return { transfer, id: create.id, events }
}

// what the worker sends when the socket dies
const dropSocket = id => deliver({ data: { id, action: 'close' } })

describe('transfer socket teardown', () => {
  test('reports an error when the socket dies mid-transfer', async () => {
    const { id, events } = await start()
    dropSocket(id)
    assert.equal(events.end.length, 0)
    assert.equal(events.error.length, 1, 'a lost socket must settle the transfer')
    assert.equal(events.error[0].message, 'Connection lost')
    // and the dead socket is torn down rather than left in the page's registry
    assert.ok(
      frames.some(f => f.action === 'close' && f.wsId === id),
      'the transfer socket should be closed'
    )
  })

  test('reports one error only, though both pending callbacks are rejected', async () => {
    const { id, events } = await start()
    // both the end and the err callback are pending, so clearOnces() rejects
    // both of them
    dropSocket(id)
    assert.equal(events.error.length, 1)
  })

  test('stays quiet on a successful transfer', async () => {
    const { id, events } = await start()
    deliver({ data: { id: 'transfer:end:' + id, data: { size: 1024 } } })
    assert.equal(events.end.length, 1)
    assert.deepEqual(events.end[0], { size: 1024 })
    // onDestroy closes the socket right after transfer:end, which rejects the
    // still-pending err callback -- that must not surface as a lost connection
    assert.equal(events.error.length, 0)
  })

  test('stays quiet on a server-reported transfer error', async () => {
    const { id, events } = await start()
    deliver({
      data: {
        id: 'transfer:err:' + id,
        data: { error: { message: 'No response from server', stack: '' } }
      }
    })
    assert.equal(events.end.length, 0)
    assert.equal(events.error.length, 1)
    assert.equal(events.error[0].message, 'No response from server')
  })

  test('stays quiet when the user cancels', async () => {
    const { transfer, events } = await start()
    transfer.destroy()
    assert.equal(events.end.length, 0)
    assert.equal(events.error.length, 0)
  })
})
