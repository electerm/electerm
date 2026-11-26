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
let forwardRemoteToLocal

before(() => {
  ({ remoteDynamicForward, forwardRemoteToLocal } = require('../../app/server/ssh-tunnel'))
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

  it('keeps a refused cancellation retryable and closes only the selected listener', async () => {
    const { SshTunnelManager } = require('../../app/server/ssh-tunnel-manager')
    const conn = new EventEmitter()
    conn.forwardIn = (host, port, cb) => cb()
    const manager = new SshTunnelManager(conn)
    const tunnel = { sshTunnel: 'remoteDynamicForward', sshTunnelRemotePort: 1080 }
    await manager.add({ ...tunnel, sshTunnelRemoteHost: '127.0.0.1' }, false)
    await manager.add({ ...tunnel, sshTunnelRemoteHost: '::1' }, true)
    const [first, second] = manager.list()
    const channels = [new PassThrough(), new PassThrough()]
    for (const [i, entry] of [first, second].entries()) {
      conn.emit('tcp connection', { destIP: entry.sshTunnel.sshTunnelRemoteHost, destPort: 1080 },
        () => channels[i])
    }

    conn.unforwardIn = (host, port, cb) => cb(new Error('Cancellation refused'))
    await manager.change('stop', second.id)
    assert.equal(manager.list()[1].status, 'running')
    assert.equal(manager.list()[1].error, 'Cancellation refused')
    assert.equal(channels[1].destroyed, false)

    conn.unforwardIn = (host, port, cb) => {
      assert.equal(host, '::1')
      assert.equal(port, 1080)
      cb()
    }
    await manager.change('stop', second.id)
    assert.equal(manager.list()[1].status, 'stopped')
    assert.equal(manager.list()[1].error, undefined)
    assert.equal(channels[1].destroyed, true)
    assert.equal(channels[0].destroyed, false)
    assert.equal(conn.listenerCount('tcp connection'), 1)
    conn.emit('close')
    assert.equal(channels[0].destroyed, true)
    assert.equal(conn.listenerCount('tcp connection'), 0)
    assert.deepEqual(manager.list(), [])
  })
})

describe('remote tunnel channel dispatch', () => {
  // sshd puts either the requested bind address (Linux OpenSSH echoes it) or the
  // concrete address it accepted on into `info.destIP`, so a hostname or wildcard
  // bind can only match by port (see channelRank).
  const loose = ['', '*', '0.0.0.0', '::', 'localhost']

  // Mirrors what the client does before it emits anything (lib/client.js
  // onCHANNEL_OPEN): `_forwarding` is keyed by the bind address we registered.
  function fakeConn () {
    const conn = new EventEmitter()
    conn._forwarding = {}
    conn.forwardIn = (host, port, cb) => {
      conn._forwarding[`${host}:${port}`] = port
      cb()
    }
    conn.unforwardIn = (host, port, cb) => {
      delete conn._forwarding[`${host}:${port}`]
      cb()
    }
    conn.deliver = (info, accept, reject) => {
      const key = `${info.destIP}:${info.destPort}`
      if (conn._forwarding[key] === undefined) return false
      conn.emit('tcp connection', info, accept, reject)
      return true
    }
    return conn
  }

  function startTunnel (conn, host, port = 8080) {
    return forwardRemoteToLocal({
      conn,
      sshTunnelRemotePort: port,
      sshTunnelRemoteHost: host,
      sshTunnelLocalPort: 1
    })
  }

  function banner (prefix) {
    return new Promise((resolve) => {
      const server = net.createServer((socket) => {
        socket.on('data', (data) => socket.write(prefix + ':' + data))
      })
      server.listen(0, '127.0.0.1', () => resolve(server))
    })
  }

  // Which local target actually received the channel, read back through it.
  async function routeOf (conn, info) {
    const { client, server } = channelPair()
    assert.equal(conn.deliver(info, () => server), true)
    client.write('hi')
    const answer = (await readBytes(client, 4)).toString()
    client.destroy()
    server.destroy()
    return answer
  }

  for (const host of loose) {
    it(`accepts a channel reported as 127.0.0.1 when the remote host is ${JSON.stringify(host)}`, async () => {
      const conn = fakeConn()
      let accepted = 0
      const stop = await startTunnel(conn, host)
      assert.equal(conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => {
        accepted++
        return new PassThrough()
      }), true)
      assert.equal(accepted, 1)
      await stop()
    })
  }

  it('stops letting channels through once the tunnel is stopped', async () => {
    const conn = fakeConn()
    const stop = await startTunnel(conn, '0.0.0.0')
    assert.equal(conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => new PassThrough()), true)
    await stop()
    assert.equal(conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => new PassThrough()), false)
    assert.deepEqual(Object.keys(conn._forwarding), [])
  })

  it('confirms a shared-port channel once when a catch-all and a specific bind coexist', async () => {
    const conn = fakeConn()
    const hits = []
    const stops = [
      await startTunnel(conn, 'localhost'),
      await startTunnel(conn, '127.0.0.2')
    ]
    // Both subscribe to the same port and both hear the channel; confirming it
    // twice would corrupt the transport (see ssh2 onCHANNEL_OPEN).
    conn.deliver({ destIP: '127.0.0.2', destPort: 8080 }, () => {
      hits.push('accept')
      return new PassThrough()
    })
    assert.deepEqual(hits, ['accept'])
    for (const stop of stops) await stop()
  })

  // A port can carry a specific address of one family next to a wildcard of the
  // other. A channel reported as 127.0.0.1 belongs to the IPv4 wildcard whichever
  // order the two were registered in, never to the IPv6 loopback.
  for (const order of [['::1', '0.0.0.0'], ['0.0.0.0', '::1']]) {
    it(`routes a shared port by address family when ${order.join(' is registered before ')}`, async () => {
      const v4 = await banner('v4')
      const v6 = await banner('v6')
      const local = { '::1': v6, '0.0.0.0': v4 }
      const conn = fakeConn()
      const stops = []
      for (const host of order) {
        stops.push(await forwardRemoteToLocal({
          conn,
          sshTunnelRemotePort: 8080,
          sshTunnelRemoteHost: host,
          sshTunnelLocalPort: local[host].address().port
        }))
      }
      try {
        assert.equal(await routeOf(conn, { destIP: '127.0.0.1', destPort: 8080 }), 'v4:hi')
        assert.equal(await routeOf(conn, { destIP: '::1', destPort: 8080 }), 'v6:hi')
      } finally {
        for (const stop of stops) await stop()
        v4.close()
        v6.close()
      }
    })
  }

  it('keeps the exact-address check when the port only has a specific bind', async () => {
    const conn = fakeConn()
    const stop = await startTunnel(conn, '::1')
    // The gate must not open for an address no listener can own, even though it
    // shares the port.
    assert.equal(conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => new PassThrough()), false)
    await stop()
  })

  // `0.0.0.0` cannot accept IPv6, so an IPv6 channel belongs to the hostname
  // bind (sshd resolved localhost to ::1) even when the wildcard registered
  // first and both would otherwise score the same.
  it('gives an IPv6 channel to a hostname bind instead of an IPv4 wildcard', async () => {
    const v4 = await banner('v4')
    const v6 = await banner('v6')
    const conn = fakeConn()
    const stops = [
      await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: '0.0.0.0',
        sshTunnelLocalPort: v4.address().port
      }),
      await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: 'localhost',
        sshTunnelLocalPort: v6.address().port
      })
    ]
    try {
      assert.equal(await routeOf(conn, { destIP: '::1', destPort: 8080 }), 'v6:hi')
      assert.equal(await routeOf(conn, { destIP: '127.0.0.1', destPort: 8080 }), 'v4:hi')
    } finally {
      for (const stop of stops) await stop()
      v4.close()
      v6.close()
    }
  })

  // The same address may be written differently: a server reports ::1 for a bind
  // that asked for 0:0:0:0:0:0:0:1, and the other way round.
  for (const [bind, reported] of [
    ['0:0:0:0:0:0:0:1', '::1'],
    ['::1', '0:0:0:0:0:0:0:1']
  ]) {
    it(`matches bind ${bind} with a server reporting ${reported}`, async () => {
      const echo = await banner('one')
      const conn = fakeConn()
      const stop = await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: bind,
        sshTunnelLocalPort: echo.address().port
      })
      try {
        assert.equal(await routeOf(conn, { destIP: reported, destPort: 8080 }), 'one:hi')
      } finally {
        await stop()
        echo.close()
      }
    })
  }

  it('treats the expanded form of the IPv6 wildcard as a wildcard', async () => {
    const echo = await banner('any6')
    const conn = fakeConn()
    const stop = await forwardRemoteToLocal({
      conn,
      sshTunnelRemotePort: 8080,
      sshTunnelRemoteHost: '0:0:0:0:0:0:0:0',
      sshTunnelLocalPort: echo.address().port
    })
    try {
      assert.equal(await routeOf(conn, { destIP: '::1', destPort: 8080 }), 'any6:hi')
    } finally {
      await stop()
      echo.close()
    }
  })

  // Two link-local listeners differ only by interface scope.
  it('keeps link-local listeners apart by their interface scope', async () => {
    const en0 = await banner('en0')
    const en1 = await banner('en1')
    const conn = fakeConn()
    const stops = [
      await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: 'fe80::1%en0',
        sshTunnelLocalPort: en0.address().port
      }),
      await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: 'fe80::1%en1',
        sshTunnelLocalPort: en1.address().port
      })
    ]
    try {
      assert.equal(await routeOf(conn, { destIP: 'fe80::1%en0', destPort: 8080 }), 'en0:hi')
      assert.equal(await routeOf(conn, { destIP: 'fe80::1%en1', destPort: 8080 }), 'en1:hi')
    } finally {
      for (const stop of stops) await stop()
      en0.close()
      en1.close()
    }
  })

  it('still matches a link-local bind when the server drops the scope', async () => {
    const echo = await banner('scoped')
    const conn = fakeConn()
    const stop = await forwardRemoteToLocal({
      conn,
      sshTunnelRemotePort: 8080,
      sshTunnelRemoteHost: 'fe80::1%en0',
      sshTunnelLocalPort: echo.address().port
    })
    try {
      assert.equal(await routeOf(conn, { destIP: 'fe80::1', destPort: 8080 }), 'scoped:hi')
    } finally {
      await stop()
      echo.close()
    }
  })

  // IPv4 carried over an IPv6 socket is the same address as the bare IPv4 one,
  // whatever spelling the server uses for it.
  for (const [bind, reported] of [
    ['0:0:0:0:0:ffff:7f00:1', '127.0.0.1'],
    ['::ffff:127.0.0.1', '0:0:0:0:0:ffff:7f00:1'],
    ['::ffff:7f00:1', '127.0.0.1'],
    ['::ffff:127.0.0.1', '::ffff:7f00:1']
  ]) {
    it(`matches mapped bind ${bind} with a server reporting ${reported}`, async () => {
      const echo = await banner('mapped')
      const conn = fakeConn()
      const stop = await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: bind,
        sshTunnelLocalPort: echo.address().port
      })
      try {
        assert.equal(await routeOf(conn, { destIP: reported, destPort: 8080 }), 'mapped:hi')
      } finally {
        await stop()
        echo.close()
      }
    })
  }

  // Interface names are case-sensitive for the OS, so two scopes that differ only
  // by case are two listeners, not one address claimed twice.
  it('keeps interface scopes case-sensitive', async () => {
    const upper = await banner('VLAN')
    const lower = await banner('vlan')
    const conn = fakeConn()
    const stops = []
    for (const [host, server] of [['fe80::1%VLAN', upper], ['fe80::1%vlan', lower]]) {
      stops.push(await forwardRemoteToLocal({
        conn,
        sshTunnelRemotePort: 8080,
        sshTunnelRemoteHost: host,
        sshTunnelLocalPort: server.address().port
      }))
    }
    try {
      assert.equal(await routeOf(conn, { destIP: 'fe80::1%VLAN', destPort: 8080 }), 'VLAN:hi')
      assert.equal(await routeOf(conn, { destIP: 'fe80::1%vlan', destPort: 8080 }), 'vlan:hi')
    } finally {
      for (const stop of stops) await stop()
      upper.close()
      lower.close()
    }
  })

  it('does not let a hostname report satisfy a specific-address listener', async () => {
    const conn = fakeConn()
    const stop = await startTunnel(conn, '127.0.0.1')
    // `net.isIP` says 0 for a hostname just like for a missing address, but only
    // a missing address may fall back to the port.
    assert.equal(conn.deliver({ destIP: 'elsewhere', destPort: 8080 }, () => new PassThrough()), false)
    let rejected = 0
    conn.emit('tcp connection', { destIP: 'elsewhere', destPort: 8080 }, () => new PassThrough(), () => {
      rejected++
    })
    assert.equal(rejected, 1)
    await stop()
  })

  it('refuses a channel two listeners claim equally', async () => {
    const conn = fakeConn()
    const stops = [
      await startTunnel(conn, 'localhost'),
      await startTunnel(conn, '')
    ]
    let accepted = 0
    let rejected = 0
    // No address separates the two hostname/empty binds, so guessing would send
    // the traffic to an arbitrary local service.
    assert.equal(conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => {
      accepted++
      return new PassThrough()
    }, () => {
      rejected++
    }), false)
    conn.emit('tcp connection', { destIP: '127.0.0.1', destPort: 8080 }, () => {
      accepted++
      return new PassThrough()
    }, () => {
      rejected++
    })
    assert.equal(accepted, 0)
    assert.equal(rejected, 1)
    for (const stop of stops) await stop()
  })

  it('confirms a shared-port channel only once when every bind is a catch-all', async () => {
    const conn = fakeConn()
    let confirmed = 0
    const stops = [
      await startTunnel(conn, '0.0.0.0'),
      await startTunnel(conn, 'localhost')
    ]
    conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => {
      confirmed++
      return new PassThrough()
    })
    assert.equal(confirmed, 1)
    for (const stop of stops) await stop()
  })

  it('rejects a channel on a port no tunnel listens on instead of leaking it', async () => {
    const conn = fakeConn()
    let accepted = 0
    let rejected = 0
    const stop = await startTunnel(conn, '0.0.0.0')
    // emitted directly: the dispatcher must still answer when the client gate
    // hands over a channel nobody owns
    conn.emit('tcp connection', { destIP: '127.0.0.1', destPort: 2222 }, () => {
      accepted++
      return new PassThrough()
    }, () => {
      rejected++
    })
    assert.equal(accepted, 0)
    assert.equal(rejected, 1)
    await stop()
  })

  it('keeps one connection-level listener for every remote tunnel', async () => {
    const conn = fakeConn()
    const stops = [
      await startTunnel(conn, '127.0.0.1'),
      await startTunnel(conn, '::1'),
      await startTunnel(conn, 'localhost')
    ]
    assert.equal(conn.listenerCount('tcp connection'), 1)
    await stops[0]()
    assert.equal(conn.listenerCount('tcp connection'), 1)
    await stops[1]()
    await stops[2]()
    assert.equal(conn.listenerCount('tcp connection'), 0)
    assert.equal(conn.deliver({ destIP: '127.0.0.1', destPort: 8080 }, () => new PassThrough()), false)
  })
})

describe('SshTunnelManager row removal', () => {
  const { SshTunnelManager } = require('../../app/server/ssh-tunnel-manager')

  it('stops a running tunnel before dropping the row, and keeps it when the server refuses', async () => {
    const conn = new EventEmitter()
    conn.forwardIn = (host, port, cb) => cb()
    conn.unforwardIn = (host, port, cb) => cb(new Error('Cancellation refused'))
    const manager = new SshTunnelManager(conn)
    await manager.add({ sshTunnel: 'remoteDynamicForward', sshTunnelRemotePort: 1080 }, false)
    const [entry] = manager.list()
    assert.equal(entry.status, 'running')

    await manager.remove(entry.id)
    assert.equal(manager.list().length, 1)
    assert.equal(manager.list()[0].status, 'running')
    assert.equal(manager.list()[0].error, 'Cancellation refused')

    conn.unforwardIn = (host, port, cb) => cb()
    await manager.remove(entry.id)
    assert.deepEqual(manager.list(), [])
    assert.equal(conn.listenerCount('tcp connection'), 0)
    await assert.rejects(manager.remove(entry.id), /no longer exists/)
  })

  it('drops a row that never started', async () => {
    const conn = new EventEmitter()
    const manager = new SshTunnelManager(conn)
    await manager.add({
      sshTunnel: 'forwardLocalToRemote',
      sshTunnelLocalPort: 0,
      sshTunnelRemotePort: 80
    }, true)
    assert.equal(manager.list()[0].status, 'error')
    await manager.remove(manager.list()[0].id)
    assert.deepEqual(manager.list(), [])
  })
})
