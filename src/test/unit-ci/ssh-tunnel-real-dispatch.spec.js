const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const { Client, Server, utils } = require('@electerm/ssh2')

// ssh-tunnel.js logs through electron-log; a silent stand-in keeps this test
// free of electron.
const logPath = require.resolve('../../app/common/log')
require.cache[logPath] = {
  id: logPath,
  filename: logPath,
  loaded: true,
  exports: { log () {}, info () {}, warn () {}, error () {}, debug () {} }
}

const { forwardRemoteToLocal } = require('../../app/server/ssh-tunnel')

// ssh2 itself only emits `tcp connection` when the channel's `${destIP}:${destPort}`
// matches a forward registered on the connection, and it reports the channel to
// every listener on that connection. Driving the real client here covers what a
// fake emitter cannot: the address the server reported, and two forwards that
// share a port.

function freePort () {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
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

// Minimal server that behaves like sshd for remote forwarding: it binds whatever
// the client asked for and reports the address it actually accepted on.
function startServer (hostKey) {
  const listeners = new Map()
  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client.on('authentication', (ctx) => ctx.accept())
    client.on('error', () => {})
    client.on('ready', () => {
      client.on('request', (accept, reject, name, info) => {
        const key = `${info.bindAddr}:${info.bindPort}`
        if (name === 'tcpip-forward') {
          const listener = net.createServer((socket) => {
            // A real server may report an address other than the one it bound;
            // `reportAddress` lets a test force that.
            const reported = server.reportAddress
              ? server.reportAddress(socket.localAddress)
              : socket.localAddress
            client.forwardOut(
              reported, socket.localPort,
              socket.remoteAddress, socket.remotePort,
              (err, stream) => {
                if (err) return socket.destroy()
                socket.pipe(stream).pipe(socket)
              }
            )
          })
          listener.once('error', () => reject && reject())
          // A server resolves a hostname bind itself; pin localhost to ::1 so
          // this does not depend on the local resolver's family preference.
          const bindAddr = info.bindAddr === 'localhost' ? '::1' : info.bindAddr
          listener.listen(info.bindPort, bindAddr, () => {
            listeners.set(key, listener)
            accept && accept()
          })
          return
        }
        if (name === 'cancel-tcpip-forward') {
          const listener = listeners.get(key)
          if (!listener) return reject && reject()
          listener.close(() => {
            listeners.delete(key)
            accept && accept()
          })
          return
        }
        reject && reject()
      })
    })
  })
  server.listeners = listeners
  server.reportAddress = null
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function connectClient (port) {
  return new Promise((resolve, reject) => {
    const client = new Client()
    client.once('ready', () => resolve(client))
    client.once('error', reject)
    client.connect({
      host: '127.0.0.1',
      port,
      username: 'tunnel',
      password: 'tunnel',
      // the host key is generated per run, so there is nothing to pin here
      hostVerifier: () => true,
      readyTimeout: 5000
    })
  })
}

function ask (port, host, payload) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => socket.write(payload))
    let buf = ''
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`no answer from ${host}:${port}`))
    }, 3000)
    socket.on('data', (data) => {
      buf += data
      if (buf.includes(payload)) {
        clearTimeout(timer)
        socket.destroy()
        resolve(buf)
      }
    })
    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe('remote forward dispatch over a real SSH connection', () => {
  let server
  let client
  let remotePort
  let targetA
  let targetB
  const stops = []

  before(async () => {
    const { private: hostKey } = utils.generateKeyPairSync('ed25519')
    targetA = await banner('a')
    targetB = await banner('b')
    server = await startServer(hostKey)
    client = await connectClient(server.address().port)
    remotePort = await freePort()
    // 127.0.0.2 is not a local address on macOS, so the second bind has to use
    // the other loopback family to stay portable.
    stops.push(
      await forwardRemoteToLocal({
        conn: client,
        sshTunnelRemoteHost: '127.0.0.1',
        sshTunnelRemotePort: remotePort,
        sshTunnelLocalPort: targetA.address().port
      }),
      await forwardRemoteToLocal({
        conn: client,
        sshTunnelRemoteHost: '::1',
        sshTunnelRemotePort: remotePort,
        sshTunnelLocalPort: targetB.address().port
      })
    )
  })

  after(async () => {
    for (const stop of stops) await stop().catch(() => {})
    client && client.end()
    if (server) {
      for (const listener of server.listeners.values()) listener.close()
      server.close()
    }
    targetA && targetA.close()
    targetB && targetB.close()
  })

  it('routes each address of a shared port to its own local target', async () => {
    assert.match(await ask(remotePort, '127.0.0.1', 'one'), /^a:one/)
    assert.match(await ask(remotePort, '::1', 'two'), /^b:two/)
    // the first tunnel must keep working after the second one received traffic
    assert.match(await ask(remotePort, '127.0.0.1', 'three'), /^a:three/)
  })

  it('accepts a channel the server reports as 127.0.0.1 for a 0.0.0.0 listener', async (t) => {
    // sshd behind `GatewayPorts no` binds loopback and reports the concrete
    // address, not the wildcard the client asked for; ssh2 drops the channel
    // unless that address is reconciled with the registered bind.
    const targetC = await banner('c')
    t.after(() => targetC.close())
    const port = await freePort()
    const stop = await forwardRemoteToLocal({
      conn: client,
      sshTunnelRemoteHost: '0.0.0.0',
      sshTunnelRemotePort: port,
      sshTunnelLocalPort: targetC.address().port
    })
    try {
      assert.match(await ask(port, '127.0.0.1', 'wild'), /^c:wild/)
    } finally {
      await stop().catch(() => {})
    }
  })

  // The IPv6 loopback and the IPv4 wildcard can share a port. Depending on the
  // registration order the channel must still land on the listener of its own
  // family, or one local service silently receives the other's traffic.
  async function askMixed (hosts, targets) {
    const port = await freePort()
    const stops = []
    try {
      for (const [i, host] of hosts.entries()) {
        stops.push(await forwardRemoteToLocal({
          conn: client,
          sshTunnelRemoteHost: host,
          sshTunnelRemotePort: port,
          sshTunnelLocalPort: targets[i].address().port
        }))
      }
      return {
        v4: await ask(port, '127.0.0.1', 'x'),
        v6: await ask(port, '::1', 'y')
      }
    } finally {
      for (const stop of stops) await stop().catch(() => {})
    }
  }

  it('keeps IPv4 traffic on the IPv4 wildcard when ::1 is registered first', async () => {
    const { v4, v6 } = await askMixed(['::1', '0.0.0.0'], [targetB, targetA])
    assert.match(v4, /^a:/)
    assert.match(v6, /^b:/)
  })

  it('keeps IPv4 traffic on the IPv4 wildcard when it is registered first', async () => {
    const { v4, v6 } = await askMixed(['0.0.0.0', '::1'], [targetA, targetB])
    assert.match(v4, /^a:/)
    assert.match(v6, /^b:/)
  })

  it('refuses a channel whose reported hostname a specific listener cannot own', async (t) => {
    // The listener really accepts on 127.0.0.1, so the TCP connection succeeds
    // and only the address in the channel open differs. `net.isIP` says 0 for a
    // hostname just like for a missing address, but a reported hostname is not a
    // reason to fall back to the port.
    const port = await freePort()
    const stop = await forwardRemoteToLocal({
      conn: client,
      sshTunnelRemoteHost: '127.0.0.1',
      sshTunnelRemotePort: port,
      sshTunnelLocalPort: targetA.address().port
    })
    t.after(() => { server.reportAddress = null })
    server.reportAddress = () => 'elsewhere.invalid'
    try {
      // `no answer` only: a refused connection would prove nothing about the gate.
      await assert.rejects(ask(port, '127.0.0.1', 'nope'), /no answer/)
    } finally {
      await stop().catch(() => {})
      server.reportAddress = null
    }
  })

  it('treats the expanded form of the IPv6 wildcard as a wildcard', async () => {
    const port = await freePort()
    const stop = await forwardRemoteToLocal({
      conn: client,
      sshTunnelRemoteHost: '0:0:0:0:0:0:0:0',
      sshTunnelRemotePort: port,
      sshTunnelLocalPort: targetB.address().port
    })
    try {
      assert.match(await ask(port, '::1', 'any6'), /^b:any6/)
    } finally {
      await stop().catch(() => {})
    }
  })

  it('keeps IPv6 traffic on a hostname bind, not on an IPv4 wildcard registered first', async () => {
    // sshd resolved localhost to ::1; the IPv4 wildcard cannot accept IPv6, so
    // the two must not be treated as equally good candidates.
    const port = await freePort()
    const stops = [
      await forwardRemoteToLocal({
        conn: client,
        sshTunnelRemoteHost: '0.0.0.0',
        sshTunnelRemotePort: port,
        sshTunnelLocalPort: targetA.address().port
      }),
      await forwardRemoteToLocal({
        conn: client,
        sshTunnelRemoteHost: 'localhost',
        sshTunnelRemotePort: port,
        sshTunnelLocalPort: targetB.address().port
      })
    ]
    try {
      assert.match(await ask(port, '::1', 'v6'), /^b:v6/)
      assert.match(await ask(port, '127.0.0.1', 'v4'), /^a:v4/)
    } finally {
      for (const stop of stops) await stop().catch(() => {})
    }
  })

  it('matches an IPv6 bind the server reports in another equivalent form', async () => {
    // The bind is written in full, the server reports the compressed address.
    const port = await freePort()
    const stop = await forwardRemoteToLocal({
      conn: client,
      sshTunnelRemoteHost: '0:0:0:0:0:0:0:1',
      sshTunnelRemotePort: port,
      sshTunnelLocalPort: targetB.address().port
    })
    try {
      assert.match(await ask(port, '::1', 'long'), /^b:long/)
    } finally {
      await stop().catch(() => {})
    }
  })
})
