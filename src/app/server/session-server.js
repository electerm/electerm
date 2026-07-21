const express = require('express')
const { Sftp } = require('./session-sftp')
const { instSftpKeys } = require('../common/constants')
const { Ftp } = require('./session-ftp')
const {
  sftp,
  transfer,
  onDestroySftp,
  onDestroyTransfer,
  terminals,
  cleanAllSessions
} = require('./remote-common')
const { Transfer, transferKeys } = require('./transfer')
const { Transfer: FtpTransfer } = require('./ftp-transfer')
const app = express()
const log = require('../common/log')
const appDec = require('./app-wrap')
const {
  createTerm,
  testTerm,
  resize,
  runCmd,
  toggleTerminalLog,
  toggleTerminalLogTimestamp,
  setTerminalLogPath,
  startTerminalLogFile
} = require('./session-api')
const {
  isWin
} = require('../common/runtime-constants')
const wsDec = require('./ws-dec')
const { zmodemManager } = require('./zmodem')
const { trzszManager } = require('./trzsz')
const { xmodemManager } = require('./xmodem')

const {
  tokenElecterm,
  electermHost,
  wsPort,
  type
} = process.env

// Track whether any WebSocket has connected to detect orphaned processes
let firstWsConnected = false
function markConnected () {
  firstWsConnected = true
}

function verify (req) {
  const { token: to } = req.query
  if (to !== tokenElecterm) {
    throw new Error('not valid request')
  }
}

appDec(app)

if (type === 'rdp') {
  app.ws('/rdp/:pid', function (ws, req) {
    const { width, height } = req.query
    verify(req)
    markConnected()
    const term = terminals(req.params.pid)
    term.ws = ws
    log.debug('ws: connected to rdp session ->', term.pid, 'width=', width, 'height=', height)
    term.start(width, height)
    ws.on('error', (err) => {
      log.error('rdp ws error:', err)
    })
    ws.on('close', () => {
      log.debug('ws: rdp session ws closed ->', term.pid)
      cleanup()
    })
  })
} else if (type === 'vnc') {
  app.ws('/vnc/:pid', function (ws, req) {
    const { query } = req
    verify(req)
    markConnected()
    const { pid } = req.params
    const term = terminals(pid)
    term.ws = ws
    term.start(query)
    log.debug('ws: connected to vnc session ->', pid)
    ws.on('error', (err) => {
      log.error(err)
    })
    ws.on('close', () => {
      cleanup()
    })
  })
} else if (type === 'spice') {
  app.ws('/spice/:pid', function (ws, req) {
    const { query } = req
    verify(req)
    markConnected()
    const { pid } = req.params
    const term = terminals(pid)
    log.debug('ws: connected to spice session ->', pid)
    term.start(query, ws)
    ws.on('error', (err) => {
      log.error(err)
    })
  })
} else {
  app.ws('/terminals/:pid', function (ws, req) {
    verify(req)
    markConnected()
    const term = terminals(req.params.pid)
    const { pid } = term
    log.debug('ws: connected to terminal ->', pid)

    const dataBuffer = []
    let sendTimeout = null

    const flushBufferedData = () => {
      if (!dataBuffer.length) {
        sendTimeout = null
        return
      }
      const combinedData = Buffer.concat(dataBuffer.splice(0).map(d => Buffer.isBuffer(d) ? d : Buffer.from(d)))

      // Write to log (keep this)
      term.writeLog(combinedData)

      // Check for zmodem escape sequence before sending to client
      const zmodemConsumed = zmodemManager.handleData(pid, combinedData, term, ws)
      if (zmodemConsumed) {
        sendTimeout = null
        return
      }

      // Check for trzsz magic key before sending to client
      const trzszConsumed = trzszManager.handleData(pid, combinedData, term, ws)
      if (trzszConsumed) {
        sendTimeout = null
        return
      }

      // Detect XMODEM auto-trigger markers from serial device
      if (term.port) {
        detectXmodemMarker(combinedData.toString('utf8'))
      }

      // Check for xmodem protocol before sending to client
      const xmodemConsumed = xmodemManager.handleData(pid, combinedData, term, ws)
      if (xmodemConsumed) {
        sendTimeout = null
        return
      }

      // Not zmodem, trzsz, or xmodem data, send to WebSocket
      ws.send(combinedData)
      sendTimeout = null
    }

    // Create ws.s function for zmodem to send messages to client
    ws.s = (data) => {
      ws.send(JSON.stringify(data))
    }

    // Auto-trigger XMODEM when the serial device sends a marker message.
    // The serial-shell.js sends these markers when the user types tx/rx.
    function detectXmodemMarker (text) {
      const txMatch = text.match(/\[XMODEM:TX:(.+?)\]/)
      if (txMatch) {
        ws.s({
          action: 'xmodem-event',
          event: 'auto-trigger-receive',
          name: txMatch[1]
        })
        return
      }
      const rxMatch = text.match(/\[XMODEM:RX\]/)
      if (rxMatch) {
        ws.s({
          action: 'xmodem-event',
          event: 'auto-trigger-send'
        })
      }
    }

    // In the WebSocket setup, replace the data handler:
    term.on('data', function (data) {
      // Check if zmodem session is active and handle data
      if (zmodemManager.isActive(pid)) {
        // Let zmodem handle the data, but still log it
        term.writeLog(data)
        zmodemManager.handleData(pid, data, term, ws)
        return
      }

      // Check if trzsz session is active and handle data
      if (trzszManager.isActive(pid)) {
        // Let trzsz handle the data, but still log it
        term.writeLog(data)
        trzszManager.handleData(pid, data, term, ws)
        return
      }

      // Detect XMODEM auto-trigger markers from serial device
      if (term.port) {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : data
        detectXmodemMarker(text)
      }

      // Check if xmodem session is active and handle data.
      // For serial terminals (term.port exists) a raw port listener (registered below)
      // bypasses rxLineEnding transformation and feeds raw bytes to xmodem.
      if (xmodemManager.isActive(pid)) {
        if (!term.port) {
          // Non-serial fallback (should not normally happen)
          term.writeLog(data)
          xmodemManager.handleData(pid, data, term, ws)
        }
        return
      }

      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data)

      // Bypass batching for very large chunks to avoid parser desync.
      if (chunk.length > 16384) {
        if (sendTimeout) {
          clearTimeout(sendTimeout)
          sendTimeout = null
        }
        if (dataBuffer.length) {
          flushBufferedData()
        }
        term.writeLog(chunk)
        const zmodemConsumed = zmodemManager.handleData(pid, chunk, term, ws)
        if (zmodemConsumed) {
          return
        }
        const trzszConsumed = trzszManager.handleData(pid, chunk, term, ws)
        if (trzszConsumed) {
          return
        }
        const xmodemConsumed = xmodemManager.handleData(pid, chunk, term, ws)
        if (xmodemConsumed) {
          return
        }
        ws.send(chunk)
        return
      }

      // Buffer incoming data instead of sending immediately for normal text workload
      dataBuffer.push(chunk)

      // If no timeout is pending, schedule a batched send
      if (!sendTimeout) {
        sendTimeout = setTimeout(flushBufferedData, 10) // Small delay (10ms) to throttle; adjust based on testing
      }
    })

    // For serial terminals, register a raw data listener directly on the port to
    // feed binary XMODEM data to xmodemManager without rxLineEnding transformation.
    if (term.port) {
      term.port.on('data', function (rawData) {
        if (xmodemManager.isActive(pid)) {
          term.writeLog(rawData)
          xmodemManager.handleData(pid, rawData, term, ws)
        }
      })
    }

    let onCloseCalled = false
    function onClose () {
      if (onCloseCalled) return
      onCloseCalled = true
      // Cancel any pending batched send
      if (sendTimeout) {
        clearTimeout(sendTimeout)
        sendTimeout = null
      }
      dataBuffer.length = 0
      // Clean up zmodem session
      zmodemManager.destroySession(pid)
      // Clean up trzsz session
      trzszManager.destroySession(pid)
      // Clean up xmodem session
      xmodemManager.destroySession(pid)
      term.kill()
      log.debug('Closed terminal ' + pid)
      // Clean things up
      ws.close && ws.close()
      cleanup()
    }

    term.on('close', onClose)
    if (term.isLocal && isWin) {
      term.on('exit', onClose)
    }

    ws.on('message', function (msg) {
      try {
        // Check if message is a zmodem or trzsz control message (JSON)
        if (typeof msg === 'string') {
          try {
            const parsed = JSON.parse(msg)
            if (parsed.action === 'zmodem-event') {
              zmodemManager.handleMessage(pid, parsed, term, ws)
              return
            }
            if (parsed.action === 'trzsz-event') {
              trzszManager.handleMessage(pid, parsed, term, ws)
              return
            }
            if (parsed.action === 'xmodem-event') {
              xmodemManager.handleMessage(pid, parsed, term, ws)
              return
            }
            if (parsed.action === 'keepalive') {
              // Write \n to the PTY.  In canonical mode the TTY line discipline
              // only delivers data to read() when a newline completes the line,
              // so \x00 (NUL) sits in the buffer and never wakes bash up.
              // A newline wakes bash's read(), resets the TMOUT alarm, and bash
              // simply re-displays the prompt.  The client suppresses that echo.
              term.write('\n\r\x1b[K')
              return
            }
          } catch (e) {
            // Not JSON, treat as regular terminal input
          }
        }
        term.write(msg)
      } catch (ex) {
        log.error(ex)
      }
    })

    ws.on('error', (err) => {
      log.error(err)
    })

    ws.on('close', onClose)
  })

  // sftp function
  app.ws('/sftp/:id', (ws, req) => {
    verify(req)
    wsDec(ws)
    const { id } = req.params
    ws.on('close', () => {
      onDestroySftp(id)
    })
    ws.on('message', (message) => {
      const msg = JSON.parse(message)
      const { action } = msg

      if (action === 'sftp-new') {
        const { id, terminalId, type } = msg
        const Cls = type === 'ftp' ? Ftp : Sftp
        sftp(id, new Cls({
          uid: id,
          terminalId,
          type
        }))
      } else if (action === 'sftp-func') {
        const { id, args, func, uid } = msg
        const inst = sftp(id)
        if (inst) {
          if (!instSftpKeys.includes(func) || typeof inst[func] !== 'function') {
            ws.s({
              id: uid,
              error: {
                message: 'invalid sftp function: ' + func,
                stack: ''
              }
            })
            return
          }
          inst[func](...args)
            .then(data => {
              ws.s({
                id: uid,
                data
              })
            })
            .catch(err => {
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
        ws.close()
        onDestroySftp(id)
      }
    })
    // end
  })

  // transfer function
  app.ws('/transfer/:id', (ws, req) => {
    verify(req)
    wsDec(ws)
    const { id } = req.params
    const { sftpId } = req.query

    ws.on('close', () => {
      onDestroyTransfer(id, sftpId)
    })

    ws.on('message', (message) => {
      const msg = JSON.parse(message)
      const { action } = msg

      if (action === 'transfer-new') {
        const { sftpId, id, isFtp } = msg
        const session = sftp(sftpId)
        const encode = session.initOptions?.encode || 'utf8'
        const opts = Object.assign({}, msg, {
          sftp: session.sftp,
          conn: session.client,
          ftpSession: isFtp ? session : null,
          sftpId,
          ws,
          encode
        })
        const Cls = isFtp ? FtpTransfer : Transfer
        transfer(id, sftpId, new Cls(opts))
      } else if (action === 'transfer-func') {
        const { id, func, args, sftpId } = msg
        if (func === 'destroy') {
          return onDestroyTransfer(id, sftpId)
        }
        if (!transferKeys.includes(func)) {
          return
        }
        const tr = transfer(id, sftpId)
        if (!tr || typeof tr[func] !== 'function') {
          return
        }
        tr[func](...args)
      }
    })
    // end
  })
}

// Add a process message handler instead
process.on('message', async (message) => {
  if (message.type === 'common') {
    const msg = message.data
    const { action, id, body } = msg

    let promise

    const ws = {
      s: (data) => {
        process.send({
          type: 'common',
          data
        })
      },
      once: (callack, id) => {
        const func = (arg) => {
          if (id === arg.id) {
            callack(arg)
            process.removeListener('message', func)
          }
        }
        process.on('message', func)
      }
    }

    if (action === 'create-terminal') {
      promise = createTerm(body, ws)
    } else if (action === 'test-terminal') {
      promise = testTerm(body, ws)
    } else if (action === 'resize-terminal') {
      promise = resize(body)
    } else if (action === 'toggle-terminal-log') {
      promise = toggleTerminalLog(body)
    } else if (action === 'toggle-terminal-log-timestamp') {
      promise = toggleTerminalLogTimestamp(body)
    } else if (action === 'set-terminal-log-path') {
      promise = setTerminalLogPath(body)
    } else if (action === 'start-terminal-log-file') {
      promise = startTerminalLogFile(body)
    } else if (action === 'run-cmd') {
      promise = runCmd(body)
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
  return new Promise((resolve) => {
    app.listen(wsPort, electermHost, () => {
      log.info('session server', 'runs on', electermHost, wsPort)
      resolve()
    })
  })
}

async function main () {
  await runServer()
  process.send({ serverInited: true })
}

main()

let cleanupCalled = false
function cleanup () {
  if (cleanupCalled) return
  cleanupCalled = true
  cleanAllSessions()
  setTimeout(() => {
    process.exit(0)
  }, 2000)
}

// Self-terminate if the parent process IPC channel disconnects (e.g. Electron crashes/restarts)
// Without this, child processes become orphans and accumulate in memory
process.on('disconnect', () => {
  log.warn('session-server: parent IPC disconnected, terminating')
  cleanup()
})

// Self-terminate if no WebSocket connects within 2 minutes of server start
// This handles the case where the frontend unmounts before the WebSocket is established
const noConnectionTimer = setTimeout(() => {
  if (!firstWsConnected) {
    log.warn('session-server: no WS connection within 2min timeout, terminating')
    cleanup()
  }
}, 120000)
if (noConnectionTimer.unref) noConnectionTimer.unref()

process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err)
  cleanup()
})
process.on('unhandledRejection', (err) => {
  log.error('unhandledRejection', err)
  cleanup()
})

process.on('SIGTERM', cleanup)
