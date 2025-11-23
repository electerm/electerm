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

    const handleTcpConnection = (info, accept, rejectConn) => {
      const srcStream = accept() // Source stream for forwarding

      // Add error handling for source stream immediately
      srcStream.on('error', (err) => {
        log.error(`Source stream error for tunnel ${result}:`, err)
      })

      // Connect the local machine source stream to the local port
      // Create a NEW server connection for each forwarded connection
      const server = require('net').connect(sshTunnelLocalPort, sshTunnelLocalHost)

      // CRITICAL: Add error handling IMMEDIATELY before any async operations
      // This prevents unhandled errors from crashing the SSH session
      server.on('error', (err) => {
        log.error(`Server connection error for tunnel ${result}:`, err.message)
        // Just close this specific connection, don't break the tunnel
        srcStream.destroy()
        server.destroy()
      })

      server.on('close', () => {
        log.log(`Local server connection closed for tunnel ${result}`)
        srcStream.end()
      })

      srcStream.on('close', () => {
        server.destroy()
      })

      srcStream.pipe(server).pipe(srcStream)
    }

    conn.on('tcp connection', handleTcpConnection)

    const handleClose = () => {
      log.log(`SSH connection closed for tunnel ${result}`)
      conn.removeListener('tcp connection', handleTcpConnection)
      conn.removeListener('close', handleClose)
    }

    conn.on('close', handleClose)

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
    const activeSockets = new Set()
    const localServer = require('net').createServer((socket) => {
      // ⬇️ 2. Add new sockets to the set and remove them when they close
      activeSockets.add(socket)
      socket.on('close', () => {
        activeSockets.delete(socket)
      })

      socket.on('error', (err) => {
        log.error('Client socket error:', err)
        socket.end()
      })

      conn.forwardOut(sshTunnelLocalHost, sshTunnelLocalPort, sshTunnelRemoteHost, sshTunnelRemotePort, (err, remoteSocket) => {
        if (err) {
          log.error('Error forwarding connection:', err)
          socket.destroy()
          // Don't reject - just close this connection
          // Rejecting would break the entire tunnel
          return
        }

        // Add error handlers immediately
        remoteSocket.on('error', (err) => {
          log.error('Remote socket error:', err)
          socket.destroy()
        })

        socket.on('close', () => {
          remoteSocket.destroy()
        })

        socket.pipe(remoteSocket).pipe(socket)
      })
    })

    localServer.listen(sshTunnelLocalPort, sshTunnelLocalHost, () => {
      log.log(`Local server listening on port ${sshTunnelLocalPort}`)
      resolve(1)
    })
    localServer.on('error', (err) => {
      log.error('Error listening for local connections:', err)
      reject(err)
    })

    conn.on('close', () => {
      log.log('SSH connection closed, closing local server.')
      // ⬇️ 3. Destroy all active sockets before closing the server
      for (const socket of activeSockets) {
        socket.destroy()
      }
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
            log.error('SOCKS forward error:', err)
            deny()
            // Don't reject - just deny this connection
            // Rejecting would break the entire tunnel
            return
          }
          const clientSocket = accept(true)
          if (clientSocket) {
            // Add error handling for stream immediately
            stream.on('error', (err) => {
              log.error('SOCKS stream error:', err)
              clientSocket.destroy()
            })

            // Add error handling for client socket immediately
            clientSocket.on('error', (err) => {
              log.error('SOCKS client socket error:', err)
              stream.destroy()
            })

            stream.on('close', () => {
              clientSocket.destroy()
            })

            clientSocket.on('close', () => {
              stream.destroy()
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
