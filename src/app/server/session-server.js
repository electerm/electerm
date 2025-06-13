const express = require('express')
const { Sftp } = require('./session-sftp')
const { Ftp } = require('./session-ftp')
const {
  sftp,
  transfer,
  onDestroySftp,
  onDestroyTransfer
} = require('./remote-common')
const { Transfer } = require('./transfer')
const { Transfer: FtpTransfer } = require('./ftp-transfer')
const app = express()
const log = require('../common/log')
const {
  createTerm,
  testTerm,
  resize,
  runCmd,
  toggleTerminalLog,
  toggleTerminalLogTimestamp
} = require('./session-api')
const {
  terminals
} = require('./remote-common')
const {
  isWin
} = require('../common/runtime-constants')
const wsDec = require('./ws-dec')

const {
  tokenElecterm,
  electermHost,
  wsPort,
  type
} = process.env

function verify (req) {
  console.log('session-server.js: Verifying request:', req.query)
  const { token: to } = req.query
  if (to !== tokenElecterm) {
    console.log('session-server.js: Invalid token:', to)
    throw new Error('not valid request')
  }
  console.log('session-server.js: Request verified successfully')
}

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }))

// parse application/json
app.use(express.json())

require('express-ws')(app, undefined, {
  wsOptions: {
    perMessageDeflate: {
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 1024 * 8,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Other options settable:
      clientNoContextTakeover: true, // Defaults to negotiated value.
      serverNoContextTakeover: true, // Defaults to negotiated value.
      serverMaxWindowBits: 10, // Defaults to negotiated value.
      // Below options specified as default values.
      concurrencyLimit: 10, // Limits zlib concurrency for perf.
      threshold: 1024 * 8 // Size (in bytes) below which messages
      // should not be compressed.
    }
  }
})
if (type === 'rdp') {
  app.ws('/rdp/:pid', function (ws, req) {
    console.log('session-server.js: RDP connection request received for pid:', req.params.pid)
    const { width, height } = req.query
    verify(req)
    const term = terminals(req.params.pid)
    console.log('session-server.js: RDP terminal found:', term.pid)
    term.ws = ws
    term.start(width, height)
    const { pid } = term
    log.debug('ws: connected to rdp session ->', pid)
    console.log('session-server.js: RDP session started for pid:', pid)
    ws.on('error', (err) => {
      console.log('session-server.js: RDP websocket error:', err)
      log.error(err)
    })
  })
} else if (type === 'vnc') {
  app.ws('/vnc/:pid', function (ws, req) {
    console.log('session-server.js: VNC connection request received for pid:', req.params.pid)
    const { query } = req
    verify(req)
    const { pid } = req.params
    const term = terminals(pid)
    console.log('session-server.js: VNC terminal found:', term.pid)
    term.ws = ws
    term.start(query)
    log.debug('ws: connected to vnc session ->', pid)
    console.log('session-server.js: VNC session started for pid:', pid)
    ws.on('error', (err) => {
      console.log('session-server.js: VNC websocket error:', err)
      log.error(err)
    })
  })
} else {
  app.ws('/terminals/:pid', function (ws, req) {
    console.log('session-server.js: Terminal connection request received for pid:', req.params.pid)
    verify(req)
    const term = terminals(req.params.pid)
    const { pid } = term
    console.log('session-server.js: Terminal found:', pid)
    log.debug('ws: connected to terminal ->', pid)

    term.on('data', function (data) {
      try {
        console.log(`session-server.js: Terminal ${pid} data received:`, data.length, 'bytes')
        term.writeLog(data)
        ws.send(Buffer.from(data))
      } catch (ex) {
        console.log('session-server.js: Error sending terminal data:', ex)
        // The WebSocket is not open, ignore
      }
    })

    function onClose () {
      console.log(`session-server.js: Closing terminal ${pid}`)
      term.kill()
      log.debug('Closed terminal ' + pid)
      // Clean things up
      ws.close && ws.close()
      console.log(`session-server.js: Terminal ${pid} closed`)
      process.exit()
    }

    term.on('close', onClose)
    if (term.isLocal && isWin) {
      term.on('exit', onClose)
    }

    ws.on('message', function (msg) {
      try {
        console.log(`session-server.js: Terminal ${pid} received message:`, msg.length, 'bytes')
        term.write(msg)
      } catch (ex) {
        console.log('session-server.js: Error writing to terminal:', ex)
        log.error(ex)
      }
    })

    ws.on('error', (err) => {
      console.log('session-server.js: Terminal websocket error:', err)
      log.error(err)
    })

    ws.on('close', onClose)
  })

  // sftp function
  app.ws('/sftp/:id', (ws, req) => {
    console.log('session-server.js: SFTP connection request received for id:', req.params.id)
    verify(req)
    wsDec(ws)
    const { id } = req.params
    ws.on('close', () => {
      console.log(`session-server.js: sessionSFTP connection ${id} closed`)
      onDestroySftp(id)
    })
    ws.on('message', (message) => {
      console.log(`session-server.js: SFTP ${id} received message`)
      const msg = JSON.parse(message)
      const { action } = msg
      console.log(`session-server.js: SFTP ${id} action:`, action)

      if (action === 'sftp-new') {
        const { id, terminalId, type } = msg
        console.log(`session-server.js: Creating new ${type} connection for id:`, id)
        const Cls = type === 'ftp' ? Ftp : Sftp
        sftp(id, new Cls({
          uid: id,
          terminalId,
          type
        }))
        console.log(`session-server.js: ${type} connection created for id:`, id)
      } else if (action === 'sftp-func') {
        const { id, args, func, uid } = msg
        console.log(`session-server.js: SFTP ${id} executing function:`, func)
        const inst = sftp(id)
        if (inst) {
          inst[func](...args)
            .then(data => {
              console.log(`session-server.js: SFTP ${id} function ${func} completed successfully`)
              ws.s({
                id: uid,
                data
              })
            })
            .catch(err => {
              console.log(`session-server.js: SFTP ${id} function ${func} failed:`, err.message)
              ws.s({
                id: uid,
                error: {
                  message: err.message,
                  stack: err.stack
                }
              })
            })
        }
      } else if (action === 'sftp-destroy') {
        const { id } = msg
        console.log(`session-server.js: Destroying SFTP connection ${id}`)
        ws.close()
        onDestroySftp(id)
      }
    })
    // end
  })

  // transfer function
  app.ws('/transfer/:id', (ws, req) => {
    console.log('session-server.js: Transfer connection request received for id:', req.params.id)
    verify(req)
    wsDec(ws)
    const { id } = req.params
    const { sftpId } = req.query
    console.log(`session-server.js: Transfer ${id} associated with SFTP ${sftpId}`)

    ws.on('close', () => {
      console.log(`session-server.js: Transfer connection ${id} closed`)
      onDestroyTransfer(id, sftpId)
    })

    ws.on('message', (message) => {
      console.log(`session-server.js: Transfer ${id} received message`)
      const msg = JSON.parse(message)
      const { action } = msg
      console.log(`session-server.js: Transfer ${id} action:`, action)

      if (action === 'transfer-new') {
        const { sftpId, id, isFtp } = msg
        console.log(`session-server.js: Creating new ${isFtp ? 'FTP' : 'SFTP'} transfer for id:`, id)
        const opts = Object.assign({}, msg, {
          sftp: sftp(sftpId).sftp,
          sftpId,
          ws
        })
        const Cls = isFtp ? FtpTransfer : Transfer
        transfer(id, sftpId, new Cls(opts))
        console.log(`session-server.js: Transfer ${id} created`)
      } else if (action === 'transfer-func') {
        const { id, func, args, sftpId } = msg
        console.log(`session-server.js: Transfer ${id} executing function:`, func)
        if (func === 'destroy') {
          console.log(`session-server.js: Destroying transfer ${id}`)
          return onDestroyTransfer(id, sftpId)
        }
        transfer(id, sftpId)[func](...args)
        console.log(`session-server.js: Transfer ${id} function ${func} executed`)
      }
    })
    // end
  })
}

// Add a process message handler instead
process.on('message', async (message) => {
  if (message.type === 'common') {
    console.log('session-server.js: Common message received from parent process')

    const msg = message.data
    const { action, id } = msg
    console.log('session-server.js: Common action:', action)

    let promise

    if (action === 'create-terminal') {
      console.log('session-server.js: Creating terminal:', msg.body.uid, msg.body)
      promise = createTerm(msg)
    } else if (action === 'test-terminal') {
      console.log('session-server.js: Testing terminal connection')
      promise = testTerm(msg)
    } else if (action === 'resize-terminal') {
      console.log(`session-server.js: Resizing terminal ${msg.pid} to ${msg.cols}x${msg.rows}`)
      promise = resize(msg)
    } else if (action === 'toggle-terminal-log') {
      console.log(`session-server.js: Toggling terminal log for ${msg.pid}`)
      promise = toggleTerminalLog(msg)
    } else if (action === 'toggle-terminal-log-timestamp') {
      console.log(`session-server.js: Toggling terminal log timestamp for ${msg.pid}`)
      promise = toggleTerminalLogTimestamp(msg)
    } else if (action === 'run-cmd') {
      console.log(`session-server.js: Running command in terminal ${msg.pid}:`, msg.cmd)
      promise = runCmd(msg)
    }

    const result = await promise
      .then(r => {
        return {
          id,
          data: r
        }
      })
      .catch(err => {
        log.error('common message error', err)
        return {
          id,
          error: {
            message: err.message,
            stack: err.stack
          }
        }
      })

    // Send the result back to the parent process
    process.send(result)
  }
})

const runServer = function () {
  console.log('session-server.js: Starting session server on', electermHost, wsPort)
  return new Promise((resolve) => {
    app.listen(wsPort, electermHost, () => {
      console.log('session-server.js: Session server started successfully')
      log.info('session server', 'runs on', electermHost, wsPort)
      resolve()
    })
  })
}

async function main () {
  console.log('session-server.js: Initializing session server')
  await runServer()
  console.log('session-server.js: Sending server initialized message to parent process')
  process.send({ serverInited: true })
}

main()

process.on('uncaughtException', (err) => {
  console.log('session-server.js: Uncaught exception:', err)
  log.error('uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  console.log('session-server.js: Unhandled rejection:', err)
  log.error('unhandledRejection', err)
})

process.on('SIGTERM', () => {
  console.log('session-server.js: SIGTERM received, exiting')
  process.exit(0)
})
