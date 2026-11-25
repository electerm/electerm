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

function listenRemote ({ conn, sshTunnelRemotePort, sshTunnelRemoteHost = '127.0.0.1' }, onConnection) {
  const clients = trackClients(onConnection)
  function onTcp (info, accept) {
    if (info.destPort === Number(sshTunnelRemotePort) &&
        (info.destIP === undefined || info.destIP === sshTunnelRemoteHost)) {
      clients.accept(accept())
    }
  }
  function cleanup () {
    conn.removeListener('tcp connection', onTcp)
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
      conn.on('tcp connection', onTcp)
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
