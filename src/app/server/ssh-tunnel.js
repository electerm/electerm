const log = require('../common/log')

function forwardRemoteToLocal ({
  conn,
  sshTunnelRemotePort,
  sshTunnelLocalPort,
  sshTunnelRemoteHost = '127.0.0.1',
  sshTunnelLocalHost = '127.0.0.1'
}) {
  return new Promise((resolve, reject) => {
    const result = `remote:${sshTunnelRemoteHost}:${sshTunnelRemotePort} => local:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
    let server = null
    conn.on('tcp connection', (info, accept, reject) => {
      const srcStream = accept() // Source stream for forwarding

      // Add error handling for source stream
      srcStream.on('error', (err) => {
        log.error('Source stream error:', err)
      })

      conn.emit('forwardIn', srcStream)
    }).on('forwardIn', (srcStream) => {
      // Connect the local machine source stream to the local port
      server = require('net').connect(sshTunnelLocalPort, sshTunnelLocalHost)

      // Add error handling for server connection
      server.on('error', (err) => {
        log.error('Server connection error:', err)
        srcStream.end()
      })

      srcStream.pipe(server).pipe(srcStream)
    }).on('close', () => {
      server && server.close && server.close()
      log.log('SSH connection closed')
    })
    // Forward the remote server's port to the local machine's port
    conn.forwardIn(sshTunnelRemoteHost, sshTunnelRemotePort, (err) => {
      if (err) {
        log.error('Error forwarding port:', err)
        return reject(err)
      }
      log.log(`Port forwarded: ${result}`)
      resolve(1)
    })
  })
}

function forwardLocalToRemote ({
  conn,
  sshTunnelRemotePort,
  sshTunnelLocalPort,
  sshTunnelRemoteHost = '127.0.0.1',
  sshTunnelLocalHost = '127.0.0.1'
}) {
  return new Promise((resolve, reject) => {
    const localServer = require('net').createServer((socket) => {
      // Add error handling for client socket
      socket.on('error', (err) => {
        log.error('Client socket error:', err)
        socket.end()
      })

      conn.forwardOut(sshTunnelLocalHost, sshTunnelLocalPort, sshTunnelRemoteHost, sshTunnelRemotePort, (err, remoteSocket) => {
        if (err) {
          log.error('Error forwarding connection:', err)
          socket.end()
          return reject(err)
        }

        // Add error handling for remote socket
        remoteSocket.on('error', (err) => {
          log.error('Remote socket error:', err)
          socket.end()
        })

        socket.pipe(remoteSocket).pipe(socket)
      })
    })
    // Start listening for local connections
    localServer.listen(sshTunnelLocalPort, sshTunnelLocalHost, () => {
      log.log(`Local server listening on port ${sshTunnelLocalPort}`)
      resolve(1)
    })
    localServer.on('error', (err) => {
      log.error('Error listening for local connections:', err)
      reject(err)
    })
    conn.on('close', () => {
      localServer && localServer.close()
    })
  })
}

function dynamicForward ({
  conn,
  sshTunnelLocalPort,
  sshTunnelLocalHost = '127.0.0.1'
}) {
  const socks = require('socksv5-electron')
  return new Promise((resolve, reject) => {
    const dproxyServer = socks.createServer((info, accept, deny) => {
      conn.forwardOut(
        info.srcAddr,
        info.srcPort,
        info.dstAddr,
        info.dstPort,
        (err, stream) => {
          if (err) {
            deny()
            return reject(err)
          }
          const clientSocket = accept(true)
          if (clientSocket) {
            // Add error handling for stream
            stream.on('error', (err) => {
              log.error('SOCKS stream error:', err)
              // clientSocket.end()
            })

            // Add error handling for client socket
            clientSocket.on('error', (err) => {
              log.error('SOCKS client socket error:', err)
              stream.end()
            })

            stream.pipe(clientSocket).pipe(stream)
          }
        })
    })
    dproxyServer.on('error', (err) => {
      log.error('Error listening for local connections:', err)
      reject(err)
    })
    dproxyServer.listen(sshTunnelLocalPort, sshTunnelLocalHost, () => {
      log.log(`SOCKS server listening on ${sshTunnelLocalHost}:${sshTunnelLocalPort}`)
      resolve(1)
    }).useAuth(socks.auth.None())

    // close socks proxy when ssh connection is closed.
    conn.on('close', () => {
      dproxyServer && dproxyServer.close()
    })
  })
}

exports.dynamicForward = dynamicForward
exports.forwardLocalToRemote = forwardLocalToRemote
exports.forwardRemoteToLocal = forwardRemoteToLocal
