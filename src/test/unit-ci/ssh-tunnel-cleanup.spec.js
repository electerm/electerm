const assert = require('node:assert/strict')
const { once } = require('node:events')
const { EventEmitter } = require('node:events')
const net = require('node:net')
const { test } = require('node:test')

const logPath = require.resolve('../../../src/app/common/log')
require.cache[logPath] = {
  id: logPath,
  filename: logPath,
  loaded: true,
  exports: { log: () => {}, error: () => {} }
}
const { forwardLocalToRemote } = require('../../../src/app/server/ssh-tunnel')

async function reservePort () {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  return port
}

test('destroys remote stream when local client closes before forwardOut completes', async () => {
  const localPort = await reservePort()
  const conn = new EventEmitter()
  let completeForwardOut
  let resolveForwardOutStarted
  const forwardOutStarted = new Promise(resolve => { resolveForwardOutStarted = resolve })
  let remoteStream
  conn.forwardOut = (_srcHost, _srcPort, _dstHost, _dstPort, callback) => {
    completeForwardOut = callback
    resolveForwardOutStarted()
  }

  let localSocketClosed
  const acceptedSocketClosed = new Promise(resolve => { localSocketClosed = resolve })
  const originalCreateServer = net.createServer
  net.createServer = (connectionListener, ...args) => originalCreateServer(socket => {
    socket.once('close', localSocketClosed)
    connectionListener(socket)
  }, ...args)
  try {
    await forwardLocalToRemote({
      conn,
      sshTunnelLocalHost: '127.0.0.1',
      sshTunnelLocalPort: localPort,
      sshTunnelRemoteHost: '127.0.0.1',
      sshTunnelRemotePort: 3202
    })
  } finally {
    net.createServer = originalCreateServer
  }

  const client = net.connect(localPort, '127.0.0.1')
  try {
    await once(client, 'connect')
    await forwardOutStarted
    assert.equal(typeof completeForwardOut, 'function', 'forwardOut should be pending')

    client.destroy()
    await once(client, 'close')
    await acceptedSocketClosed

    remoteStream = new EventEmitter()
    remoteStream.destroyed = false
    remoteStream.writable = true
    remoteStream.write = () => true
    remoteStream.pipe = destination => destination
    remoteStream.end = () => { remoteStream.writableEnded = true; return remoteStream }
    remoteStream.destroy = () => { remoteStream.destroyed = true; return remoteStream }
    completeForwardOut(null, remoteStream)

    assert.equal(remoteStream.destroyed, true, 'late remote stream must be destroyed')
  } finally {
    client.destroy()
    remoteStream?.destroy()
    conn.emit('close')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
})
