const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { PassThrough, Duplex } = require('node:stream')
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

let remoteDynamicForward

before(() => {
  ({ remoteDynamicForward } = require('../../app/server/ssh-tunnel'))
})

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A forwarded-tcpip channel is a plain duplex stream: it has no local or remote
// socket address, which is the part a net.Socket based test would hide.
function channelPair () {
  const up = new PassThrough() // client -> server
  const down = new PassThrough() // server -> client
  const makeEnd = (outgoing) => new Duplex({
    read () {},
    write (chunk, enc, cb) {
      outgoing.write(chunk, enc, cb)
    },
    final (cb) {
      outgoing.end()
      cb()
    }
  })
  const client = makeEnd(up)
  const server = makeEnd(down)
  up.on('data', (d) => server.push(d))
  down.on('data', (d) => client.push(d))
  return { client, server }
}

function readBytes (stream, count, timeout = 2000) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0)
    const timer = setTimeout(() => {
      stream.removeListener('data', onData)
      reject(new Error(`timed out waiting for ${count} bytes, got ${buf.length}`))
    }, timeout)
    const onData = (d) => {
      buf = Buffer.concat([buf, d])
      if (buf.length >= count) {
        clearTimeout(timer)
        stream.removeListener('data', onData)
        resolve(buf)
      }
    }
    stream.on('data', onData)
  })
}

function connectRequest (host, port) {
  const name = Buffer.from(host)
  const buf = Buffer.concat([
    Buffer.from([5, 1, 0, 3, name.length]),
    name,
    Buffer.alloc(2)
  ])
  buf.writeUInt16BE(port, buf.length - 2)
  return buf
}

// a stand-in for "something only this machine can reach"
function localEchoServer () {
  return new Promise((resolve) => {
    const server = net.createServer((s) => {
      s.on('data', (d) => s.write('echo:' + d))
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

describe('remoteDynamicForward', () => {
  it('asks the server to listen and dials the destination from this machine', async () => {
    const echo = await localEchoServer()
    const conn = new EventEmitter()
    const forwardIn = new Promise((resolve) => {
      conn.forwardIn = (host, port, cb) => {
        resolve({ host, port })
        cb()
      }
    })
    // ssh -R port must not ask the server to open the destination: that would
    // send the traffic out of the server's network instead of ours
    conn.forwardOut = () => {
      throw new Error('remote dynamic forwarding must not use forwardOut')
    }

    try {
      await remoteDynamicForward({
        conn,
        sshTunnelRemotePort: 1080,
        sshTunnelRemoteHost: '127.0.0.1'
      })

      assert.deepEqual(await forwardIn, { host: '127.0.0.1', port: 1080 })

      const { client, server } = channelPair()
      conn.emit('tcp connection', {
        destIP: '127.0.0.1',
        destPort: 1080
      }, () => server)

      // socks5 handshake, no auth
      client.write(Buffer.from([5, 1, 0]))
      assert.deepEqual([...await readBytes(client, 2)], [5, 0])

      client.write(connectRequest('127.0.0.1', echo.address().port))
      const reply = await readBytes(client, 10)
      assert.equal(reply[0], 5)
      assert.equal(reply[1], 0) // succeeded

      client.write('ping')
      assert.equal((await readBytes(client, 9)).toString(), 'echo:ping')

      client.destroy()
      server.destroy()
      conn.emit('close')
    } finally {
      echo.close()
    }
  })

  it('denies the socks request when the destination is unreachable', async () => {
    const conn = new EventEmitter()
    conn.forwardIn = (host, port, cb) => cb()

    await remoteDynamicForward({ conn, sshTunnelRemotePort: 1080 })

    const { client, server } = channelPair()
    conn.emit('tcp connection', { destPort: 1080 }, () => server)

    client.write(Buffer.from([5, 1, 0]))
    await readBytes(client, 2)

    // nothing listens on port 1; socksv5-server answers with the short
    // [ver, rep] form and closes the stream
    client.write(connectRequest('127.0.0.1', 1))
    const reply = await readBytes(client, 2)
    assert.deepEqual([...reply], [5, 2]) // connection not allowed by ruleset

    client.destroy()
    server.destroy()
    conn.emit('close')
  })

  it('ignores connections aimed at another tunnel on the same connection', async () => {
    const conn = new EventEmitter()
    conn.forwardIn = (host, port, cb) => cb()
    conn.forwardOut = () => {
      throw new Error('should not forward anything')
    }
    let accepted = 0

    await remoteDynamicForward({ conn, sshTunnelRemotePort: 1080 })

    conn.emit('tcp connection', { destPort: 2222 }, () => {
      accepted++
    })
    await wait(50)
    assert.equal(accepted, 0)
    conn.emit('close')
  })

  it('rejects when the server refuses to open the remote port', async () => {
    const conn = new EventEmitter()
    conn.forwardIn = (host, port, cb) => cb(new Error('Unable to bind to 127.0.0.1:1080'))

    await assert.rejects(
      remoteDynamicForward({ conn, sshTunnelRemotePort: 1080 }),
      /Unable to bind/
    )
    // the failed tunnel must not leave a listener behind
    assert.equal(conn.listenerCount('tcp connection'), 0)
    assert.equal(conn.listenerCount('close'), 0)
  })
})
