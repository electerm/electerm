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
  console.log('Verifying request:', req.query)
  const { token: to } = req.query
  if (to !== tokenElecterm) {
    console.log('Invalid token:', to)
    throw new Error('not valid request')
  }
  console.log('Request verified successfully')
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
    console.log('RDP connection request received for pid:', req.params.pid)
    const { width, height } = req.query
    verify(req)
    const term = terminals(req.params.pid)
    console.log('RDP terminal found:', term.pid)
    term.ws = ws
    term.start(width, height)
    const { pid } = term
    log.debug('ws: connected to rdp session ->', pid)
    console.log('RDP session started for pid:', pid)
    ws.on('error', (err) => {
      console.log('RDP websocket error:', err)
      log.error(err)
    })
  })
} else if (type === 'vnc') {
  app.ws('/vnc/:pid', function (ws, req) {
    console.log('VNC connection request received for pid:', req.params.pid)
    const { query } = req
    verify(req)
    const { pid } = req.params
    const term = terminals(pid)
    console.log('VNC terminal found:', term.pid)
    term.ws = ws
    term.start(query)
    log.debug('ws: connected to vnc session ->', pid)
    console.log('VNC session started for pid:', pid)
    ws.on('error', (err) => {
      console.log('VNC websocket error:', err)
      log.error(err)
    })
  })
} else {
  app.ws('/terminals/:pid', function (ws, req) {
    console.log('Terminal connection request received for pid:', req.params.pid)
    verify(req)
    const term = terminals(req.params.pid)
    const { pid } = term
    console.log('Terminal found:', pid)
    log.debug('ws: connected to terminal ->', pid)

    term.on('data', function (data) {
      try {
        console.log(`Terminal ${pid} data received:`, data.length, 'bytes')
        term.writeLog(data)
        ws.send(Buffer.from(data))
      } catch (ex) {
        console.log('Error sending terminal data:', ex)
        // The WebSocket is not open, ignore
      }
    })

    function onClose () {
      console.log(`Closing terminal ${pid}`)
      term.kill()
      log.debug('Closed terminal ' + pid)
      // Clean things up
      ws.close && ws.close()
      console.log(`Terminal ${pid} closed`)
    }

    term.on('close', onClose)
    if (term.isLocal && isWin) {
      term.on('exit', onClose)
    }

    ws.on('message', function (msg) {
      try {
        console.log(`Terminal ${pid} received message:`, msg.length, 'bytes')
        term.write(msg)
      } catch (ex) {
        console.log('Error writing to terminal:', ex)
        log.error(ex)
      }
    })

    ws.on('error', (err) => {
      console.log('Terminal websocket error:', err)
      log.error(err)
    })

    ws.on('close', onClose)
  })

  // sftp function
  app.ws('/sftp/:id', (ws, req) => {
    console.log('SFTP connection request received for id:', req.params.id)
    verify(req)
    wsDec(ws)
    const { id } = req.params
    ws.on('close', () => {
      console.log(`SFTP connection ${id} closed`)
      onDestroySftp(id)
    })
    ws.on('message', (message) => {
      console.log(`SFTP ${id} received message`)
      const msg = JSON.parse(message)
      const { action } = msg
      console.log(`SFTP ${id} action:`, action)

      if (action === 'sftp-new') {
        const { id, terminalId, type } = msg
        console.log(`Creating new ${type} connection for id:`, id)
        const Cls = type === 'ftp' ? Ftp : Sftp
        sftp(id, new Cls({
          uid: id,
          terminalId,
          type
        }))
        console.log(`${type} connection created for id:`, id)
      } else if (action === 'sftp-func') {
        const { id, args, func, uid } = msg
        console.log(`SFTP ${id} executing function:`, func)
        const inst = sftp(id)
        if (inst) {
          inst[func](...args)
            .then(data => {
              console.log(`SFTP ${id} function ${func} completed successfully`)
              ws.s({
                id: uid,
                data
              })
            })
            .catch(err => {
              console.log(`SFTP ${id} function ${func} failed:`, err.message)
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
        console.log(`Destroying SFTP connection ${id}`)
        ws.close()
        onDestroySftp(id)
      }
    })
    // end
  })

  // transfer function
  app.ws('/transfer/:id', (ws, req) => {
    console.log('Transfer connection request received for id:', req.params.id)
    verify(req)
    wsDec(ws)
    const { id } = req.params
    const { sftpId } = req.query
    console.log(`Transfer ${id} associated with SFTP ${sftpId}`)

    ws.on('close', () => {
      console.log(`Transfer connection ${id} closed`)
      onDestroyTransfer(id, sftpId)
    })

    ws.on('message', (message) => {
      console.log(`Transfer ${id} received message`)
      const msg = JSON.parse(message)
      const { action } = msg
      console.log(`Transfer ${id} action:`, action)

      if (action === 'transfer-new') {
        const { sftpId, id, isFtp } = msg
        console.log(`Creating new ${isFtp ? 'FTP' : 'SFTP'} transfer for id:`, id)
        const opts = Object.assign({}, msg, {
          sftp: sftp(sftpId).sftp,
          sftpId,
          ws
        })
        const Cls = isFtp ? FtpTransfer : Transfer
        transfer(id, sftpId, new Cls(opts))
        console.log(`Transfer ${id} created`)
      } else if (action === 'transfer-func') {
        const { id, func, args, sftpId } = msg
        console.log(`Transfer ${id} executing function:`, func)
        if (func === 'destroy') {
          console.log(`Destroying transfer ${id}`)
          return onDestroyTransfer(id, sftpId)
        }
        transfer(id, sftpId)[func](...args)
        console.log(`Transfer ${id} function ${func} executed`)
      }
    })
    // end
  })
}

app.ws('/common/s', (ws, req) => {
  console.log('Common socket connection request received')
  verify(req)
  wsDec(ws)
  ws.on('message', async (message) => {
    console.log('Common socket received message')
    try {
      const msg = JSON.parse(message)
      const { action } = msg
      console.log('Common socket action:', action)

      if (action === 'create-terminal') {
        console.log('Creating terminal:', msg.id)
        createTerm(ws, msg)
      } else if (action === 'test-terminal') {
        console.log('Testing terminal connection')
        testTerm(ws, msg)
      } else if (action === 'resize-terminal') {
        console.log(`Resizing terminal ${msg.pid} to ${msg.cols}x${msg.rows}`)
        resize(ws, msg)
      } else if (action === 'toggle-terminal-log') {
        console.log(`Toggling terminal log for ${msg.pid}`)
        toggleTerminalLog(ws, msg)
      } else if (action === 'toggle-terminal-log-timestamp') {
        console.log(`Toggling terminal log timestamp for ${msg.pid}`)
        toggleTerminalLogTimestamp(ws, msg)
      } else if (action === 'run-cmd') {
        console.log(`Running command in terminal ${msg.pid}:`, msg.cmd)
        runCmd(ws, msg)
      }
    } catch (err) {
      console.log('Error processing common socket message:', err)
      log.error('common ws error', err)
    }
  })
})

const runServer = function () {
  console.log('Starting session server on', electermHost, wsPort)
  return new Promise((resolve) => {
    app.listen(wsPort, electermHost, () => {
      console.log('Session server started successfully')
      log.info('session server', 'runs on', electermHost, wsPort)
      resolve()
    })
  })
}

async function main () {
  console.log('Initializing session server')
  await runServer()
  console.log('Sending server initialized message to parent process')
  process.send({ serverInited: true })
}

main()

process.on('uncaughtException', (err) => {
  console.log('Uncaught exception:', err)
  log.error('uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  console.log('Unhandled rejection:', err)
  log.error('unhandledRejection', err)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, exiting')
  process.exit(0)
})
