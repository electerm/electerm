const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const net = require('node:net')

// ssh-tunnel.js logs through electron-log; a silent stand-in keeps this test
// free of electron.
const logPath = require.resolve('../../app/common/log')
require.cache[logPath] = {
  id: logPath,
  filename: logPath,
  loaded: true,
  exports: { log () {}, info () {}, warn () {}, error () {}, debug () {} }
}

let forwardLocalToRemote

before(() => {
  ({ forwardLocalToRemote } = require('../../app/server/ssh-tunnel'))
})

function freePort () {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('forwardLocalToRemote', () => {
  it('closes the forwarded channel when the client resets before it opens', async () => {
    const conn = new EventEmitter()
    const channelRequested = new Promise((resolve) => {
      conn.forwardOut = (srcHost, srcPort, dstHost, dstPort, cb) => resolve(cb)
    })
    const port = await freePort()
    await forwardLocalToRemote({ conn, sshTunnelLocalPort: port, sshTunnelRemotePort: 22 })
    const remote = new PassThrough()
    try {
      const client = net.connect(port, '127.0.0.1')
      await new Promise((resolve) => client.once('connect', resolve))
      const openChannel = await channelRequested
      client.resetAndDestroy() // RST before the direct-tcpip channel is open
      await wait(100)

      openChannel(null, remote) // the channel opens after the client is gone
      await wait(20)

      assert.equal(remote.destroyed, true)
    } finally {
      remote.destroy()
      conn.emit('close') // closes the local server
    }
  })

  it('still pipes data both ways and closes the channel with the client', async () => {
    const conn = new EventEmitter()
    const remote = new PassThrough() // echoes what the client writes
    conn.forwardOut = (srcHost, srcPort, dstHost, dstPort, cb) => cb(null, remote)
    const port = await freePort()
    await forwardLocalToRemote({ conn, sshTunnelLocalPort: port, sshTunnelRemotePort: 22 })
    try {
      const client = net.connect(port, '127.0.0.1')
      await new Promise((resolve) => client.once('connect', resolve))
      client.write('ping')
      const echoed = await new Promise((resolve) => client.once('data', resolve))
      assert.equal(echoed.toString(), 'ping')

      client.destroy()
      await wait(50)
      assert.equal(remote.destroyed, true)
    } finally {
      remote.destroy()
      conn.emit('close')
    }
  })
})
