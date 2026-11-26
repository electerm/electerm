const net = require('net')
const socks = require('socksv5-server')
const log = require('../common/log')

function pipeSockets (client, target) {
  target.on('error', err => {
    log.error('Tunnel destination:', err.message)
    client?.destroy()
  })
  if (!client || client.destroyed) {
    target.destroy()
    return
  }
  client.once('close', () => target.destroy())
  target.once('close', () => client.destroy())
  client.pipe(target).pipe(client)
}

// Each listener owns its clients, including unfinished SOCKS handshakes.
function trackClients (onConnection) {
  const clients = new Set()
  return {
    accept (socket) {
      if (!socket) return
      clients.add(socket)
      socket.once('close', () => clients.delete(socket))
      socket.on('error', err => {
        log.error('Tunnel client:', err.message)
        socket.destroy()
      })
      onConnection(socket)
    },
    close () {
      for (const socket of clients) socket.destroy()
    }
  }
}

function listenLocal ({ conn, sshTunnelLocalPort, sshTunnelLocalHost = '127.0.0.1' }, onConnection) {
  return new Promise((resolve, reject) => {
    const clients = trackClients(onConnection)
    const server = net.createServer(clients.accept)
    const onClose = () => {
      reject(new Error('SSH connection closed while starting tunnel'))
      stop()
    }
    const stop = () => {
      conn.removeListener('close', onClose)
      server.close()
      clients.close()
    }
    server.on('error', err => {
      reject(err)
      stop()
      log.error('Tunnel listener:', err.message)
    })
    conn.once('close', onClose)
    try {
      server.listen(sshTunnelLocalPort, sshTunnelLocalHost, () => resolve(stop))
    } catch (err) {
      reject(err)
      stop()
    }
  })
}

// ssh2 hands every incoming forwarded channel to one connection-level event and
// leaves accept/reject to us, so all of this connection's remote forwards hear
// the same channel. Confirming the same channel twice corrupts the transport,
// therefore each channel is dispatched to exactly one listener.
//
// `info.destIP` is whatever the server puts in the channel open: some sshd
// versions echo the address the client asked for (so `-R localhost:8080` reports
// "localhost" and `-R 0.0.0.0:8080` reports "0.0.0.0"), others report the
// concrete address they accepted on (127.0.0.1, ::1, a NIC IP). Both styles have
// to end up at the same listener, and a port can be shared by a specific address
// and a wildcard of the other family, so the address has to narrow the choice:
//
//   3  the server reported the address this listener asked for
//   2  this listener is the wildcard of the family the channel arrived on
//   1  there is no address to compare (hostname bind, or the server sent none)
//   0  anything else: another address, or a wildcard of the other family
//
// Matching by port alone made an `-R ::1:p` registered before `-R 0.0.0.0:p` take
// the IPv4 traffic; a specific bind is now limited to its own address, which is
// exactly what this listened to before any of the fallback work. `0.0.0.0` never
// serves an IPv6 channel either -- otherwise a `-R localhost:p` that sshd bound
// to ::1 could lose its traffic to an IPv4 wildcard registered first.
const WILDCARD_BINDS = new Set(['', '*'])

function expandIPv6 (ip) {
  let value = ip
  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value)
  if (dotted) {
    const high = (Number(dotted[2]) << 8) | Number(dotted[3])
    const low = (Number(dotted[4]) << 8) | Number(dotted[5])
    value = `${dotted[1]}${high.toString(16)}:${low.toString(16)}`
  }
  const [head, tail] = value.split('::')
  const groups = (part) => part ? part.split(':') : []
  const left = groups(head)
  const right = tail === undefined ? [] : groups(tail)
  const all = tail === undefined
    ? left
    : left.concat(new Array(8 - left.length - right.length).fill('0'), right)
  return all.map(group => parseInt(group, 16).toString(16).padStart(4, '0')).join(':')
}

function splitZone (host) {
  const at = host.indexOf('%')
  return at === -1 ? [host, ''] : [host.slice(0, at), host.slice(at + 1)]
}

// `::ffff:127.0.0.1` is IPv4 carried over an IPv6 socket, so it belongs to the
// IPv4 family and is equal to 127.0.0.1 for the purpose of matching a bind. The
// address is expanded first, so every spelling of the same value -- dotted or
// hex tail, compressed or written out as 0:0:0:0:0:ffff:7f00:1 -- ends up as the
// one IPv4 address.
const MAPPED_IPV4_PREFIX = expandIPv6('::ffff:0:0').split(':').slice(0, 6).join(':') + ':'

function mappedIPv4 (host) {
  if (typeof host !== 'string') return null
  const ip = splitZone(host)[0]
  if (net.isIP(ip) !== 6) return null
  const value = expandIPv6(ip)
  if (!value.startsWith(MAPPED_IPV4_PREFIX)) return null
  const [high, low] = value.slice(MAPPED_IPV4_PREFIX.length).split(':')
    .map(group => parseInt(group, 16))
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}

function ipFamily (host) {
  if (typeof host !== 'string') return 0
  const family = net.isIP(splitZone(host.trim())[0])
  if (family === 6 && mappedIPv4(host)) return 4
  return family
}

// The server may report `::1` for a bind written as `0:0:0:0:0:0:0:1`, so the
// comparison has to be on the address value, not on the text. Only the address
// itself is case-insensitive: the interface scope is an operating-system name and
// keeps its case, because fe80::1%VLAN and fe80::1%vlan are different listeners.
function addressKey (host) {
  if (typeof host !== 'string') return null
  const [text, zone] = splitZone(host.trim())
  const ip = text.toLowerCase()
  const family = net.isIP(ip)
  if (family === 0) return null
  const mapped = mappedIPv4(ip)
  if (mapped) return 'v4:' + mapped
  return family === 4 ? 'v4:' + ip : `v6:${expandIPv6(ip)}${zone ? '%' + zone : ''}`
}

// `0.0.0.0` and `::` in every spelling, including the expanded IPv6 form.
const ANY_V4 = 'v4:0.0.0.0'
const ANY_V6 = 'v6:' + expandIPv6('::')

function sameAddress (bind, reported) {
  if (bind === reported) return true
  const a = addressKey(bind)
  const b = addressKey(reported)
  if (a === null || b === null) return false
  if (a === b) return true
  // A missing scope on either side still names the same address, but two
  // different scopes do not.
  const [aValue, aZone] = splitZone(a)
  const [bValue, bZone] = splitZone(b)
  return aValue === bValue && (!aZone || !bZone)
}

function channelRank (record, info) {
  if (record.port !== Number(info.destPort)) return 0
  const destIP = typeof info.destIP === 'string' ? info.destIP : ''
  if (sameAddress(record.host, destIP)) return 3
  const destFamily = ipFamily(destIP)
  const bindKey = addressKey(record.host)
  // Compare the canonical address, so `0:0:0:0:0:0:0:0` counts as `::`.
  if (bindKey === ANY_V4) return destFamily === 6 ? 0 : 2
  if (bindKey === ANY_V6) return destFamily === 4 ? 1 : 2
  // A hostname bind has no address to compare with.
  if (WILDCARD_BINDS.has(record.host) || bindKey === null) return 1
  // A specific address never claims another address on the same port, and a
  // reported hostname is another address, not a missing one. Only a channel
  // without any address at all is left unjudged.
  return destIP === '' ? 1 : 0
}

// One dispatcher per connection, so a channel can never be accepted twice.
const dispatchers = new WeakMap()

function createDispatcher (conn) {
  const records = new Set()
  // A channel goes to the single best match. A tie at the top means two tunnels
  // claim it equally, and neither is provably right, so the channel is rejected
  // instead of being handed to whichever happened to register first.
  function pick (info) {
    let target
    let rank = 0
    let tied = false
    for (const record of records) {
      const current = channelRank(record, info)
      if (current > rank) {
        target = record
        rank = current
        tied = false
      } else if (current === rank && current > 0) {
        tied = true
      }
    }
    return tied ? undefined : target
  }
  const onTcp = (info, accept, reject) => {
    const target = pick(info)
    if (!target) return reject && reject()
    target.accept(accept())
  }
  const dispatcher = {
    add (record) {
      records.add(record)
    },
    remove (record) {
      records.delete(record)
      if (records.size) return
      conn.removeListener('tcp connection', onTcp)
      if (dispatchers.get(conn) === dispatcher) dispatchers.delete(conn)
    },
    // Shared with the gate bridge below: a channel may only skip ssh2's exact
    // key check when a listener here could actually own it, so a specific
    // address keeps its constraint instead of quietly accepting any address on
    // its port.
    owns (destIP, destPort) {
      return !!pick({ destIP, destPort })
    }
  }
  conn.on('tcp connection', onTcp)
  return dispatcher
}

function remoteDispatcher (conn) {
  let dispatcher = dispatchers.get(conn)
  if (!dispatcher) {
    dispatcher = createDispatcher(conn)
    dispatchers.set(conn, dispatcher)
  }
  return dispatcher
}

// ssh2 drops a forwarded channel before emitting anything unless its private
// `_forwarding` map holds the exact `${destIP}:${destPort}` key, and that map is
// keyed by the bind address we asked for. A wildcard or hostname bind therefore
// loses every channel from servers that report the address they actually accepted
// on (sshd behind `GatewayPorts no` binds loopback and reports 127.0.0.1). We did
// ask for that forward, so let a channel for the port through when the dispatcher
// says some listener owns it -- the same channelRank rule that later picks the
// receiver, so a port registered only on a specific address is left as strict as
// before. Ownership is still decided once, by the dispatcher.
//
// This is a shim over a private field of the pinned @electerm/ssh2; drop it once
// the channel matching there accepts a wildcard registration by port.
const gateBridges = new WeakMap()

function bridgeForwardGate (conn, dispatcher, port) {
  let bridge = gateBridges.get(conn)
  if (!bridge) {
    const forwarding = conn._forwarding
    if (!forwarding) return () => {}
    bridge = { ports: new Map(), forwarding, proxy: null }
    bridge.proxy = new Proxy(forwarding, {
      get (target, key) {
        const value = target[key]
        if (value !== undefined || typeof key !== 'string') return value
        const sep = key.lastIndexOf(':')
        if (sep < 0) return value
        const destPort = Number(key.slice(sep + 1))
        if (!bridge.ports.has(destPort)) return value
        if (!dispatcher.owns(key.slice(0, sep), destPort)) return value
        return destPort
      }
    })
    conn._forwarding = bridge.proxy
    gateBridges.set(conn, bridge)
  }
  bridge.ports.set(port, (bridge.ports.get(port) || 0) + 1)
  return function release () {
    const count = bridge.ports.get(port) || 0
    if (count > 1) {
      bridge.ports.set(port, count - 1)
      return
    }
    bridge.ports.delete(port)
    if (bridge.ports.size) return
    if (conn._forwarding === bridge.proxy) conn._forwarding = bridge.forwarding
    gateBridges.delete(conn)
  }
}

function listenRemote ({ conn, sshTunnelRemotePort, sshTunnelRemoteHost = '127.0.0.1' }, onConnection) {
  const clients = trackClients(onConnection)
  const record = {
    host: sshTunnelRemoteHost,
    port: Number(sshTunnelRemotePort),
    accept: channel => clients.accept(channel)
  }
  let dispatcher
  let releaseGate
  function cleanup () {
    if (dispatcher) dispatcher.remove(record)
    if (releaseGate) releaseGate()
    conn.removeListener('close', cleanup)
    clients.close()
  }
  function stop () {
    return new Promise((resolve, reject) => {
      conn.unforwardIn(sshTunnelRemoteHost, sshTunnelRemotePort, err => {
        if (err) return reject(err)
        cleanup()
        resolve()
      })
    })
  }
  return new Promise((resolve, reject) => {
    conn.forwardIn(sshTunnelRemoteHost, sshTunnelRemotePort, err => {
      if (err) return reject(err)
      dispatcher = remoteDispatcher(conn)
      dispatcher.add(record)
      releaseGate = bridgeForwardGate(conn, dispatcher, record.port)
      conn.once('close', cleanup)
      resolve(stop)
    })
  })
}

function forwardOut (conn, srcHost, srcPort, destHost, destPort, callback) {
  // ssh2 throws synchronously if the transport drops before its close event.
  try {
    conn.forwardOut(srcHost, srcPort, destHost, destPort, callback)
  } catch (err) {
    callback(err)
  }
}

function forwardLocalToRemote (options) {
  const {
    conn, sshTunnelLocalHost = '127.0.0.1', sshTunnelLocalPort,
    sshTunnelRemoteHost = '127.0.0.1', sshTunnelRemotePort
  } = options
  return listenLocal(options, socket => {
    forwardOut(conn, sshTunnelLocalHost, sshTunnelLocalPort, sshTunnelRemoteHost, sshTunnelRemotePort, (err, stream) => {
      if (err) {
        log.error('Tunnel forward:', err.message)
        return socket.destroy()
      }
      pipeSockets(socket, stream)
    })
  })
}

function forwardRemoteToLocal (options) {
  const { sshTunnelLocalPort, sshTunnelLocalHost = '127.0.0.1' } = options
  return listenRemote(options, channel => {
    pipeSockets(channel, net.connect(sshTunnelLocalPort, sshTunnelLocalHost))
  })
}

// socksv5-server's stream entry point also works for a forwarded SSH channel.
// Keep the source socket available during setup so stop can cancel a pending dial.
function socksHandler (connect) {
  return socket => {
    const server = socks.createServer((info, accept, deny) => {
      connect(info, socket, (err, stream) => {
        if (err) {
          log.error('SOCKS forward:', err.message)
          return deny()
        }
        pipeSockets(accept(true), stream)
      })
    })
    server.useAuth(socks.auth.None())
    server._onConnection(socket)
  }
}

function dynamicForward (options) {
  return listenLocal(options, socksHandler((info, socket, done) => {
    forwardOut(options.conn, info.srcAddr, info.srcPort, info.dstAddr, info.dstPort, done)
  }))
}

function remoteDynamicForward (options) {
  return listenRemote(options, socksHandler((info, channel, done) => {
    // Remote SOCKS destinations are dialled from this machine (ssh -R port).
    const target = net.connect(info.dstPort, info.dstAddr)
    const cancel = () => target.destroy()
    channel.once('close', cancel)
    target.once('error', done)
    target.once('connect', () => {
      target.removeListener('error', done)
      channel.removeListener('close', cancel)
      done(null, target)
    })
    target.once('close', () => channel.removeListener('close', cancel))
  }))
}

module.exports = { dynamicForward, forwardLocalToRemote, forwardRemoteToLocal, remoteDynamicForward }
