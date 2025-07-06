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
const appDec = require('./app-wrap')
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
    const term = terminals(req.params.pid)
    term.ws = ws
    term.start(width, height)
    const { pid } = term
    log.debug('ws: connected to rdp session ->', pid)
    ws.on('error', (err) => {
      log.error(err)
    })
  })
} else if (type === 'vnc') {
  app.ws('/vnc/:pid', function (ws, req) {
    const { query } = req
    verify(req)
    const { pid } = req.params
    const term = terminals(pid)
    term.ws = ws
    term.start(query)
    log.debug('ws: connected to vnc session ->', pid)
    ws.on('error', (err) => {
      log.error(err)
    })
  })
} else {
  app.ws('/terminals/:pid', function (ws, req) {
    verify(req)
    const term = terminals(req.params.pid)
    const { pid } = term
    log.debug('ws: connected to terminal ->', pid)

    term.on('data', function (data) {
      try {
        term.writeLog(data)
        ws.send(Buffer.from(data))
      } catch (err) {
        log.error(err)
      }
    })

    function onClose () {
      term.kill()
      log.debug('Closed terminal ' + pid)
      // Clean things up
      ws.close && ws.close()
      process.exit()
    }

    term.on('close', onClose)
    if (term.isLocal && isWin) {
      term.on('exit', onClose)
    }

    ws.on('message', function (msg) {
      try {
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
        const opts = Object.assign({}, msg, {
          sftp: sftp(sftpId).sftp,
          sftpId,
          ws
        })
        const Cls = isFtp ? FtpTransfer : Transfer
        transfer(id, sftpId, new Cls(opts))
      } else if (action === 'transfer-func') {
        const { id, func, args, sftpId } = msg
        if (func === 'destroy') {
          return onDestroyTransfer(id, sftpId)
        }
        transfer(id, sftpId)[func](...args)
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
      promise = testTerm(body)
    } else if (action === 'resize-terminal') {
      promise = resize(body)
    } else if (action === 'toggle-terminal-log') {
      promise = toggleTerminalLog(body)
    } else if (action === 'toggle-terminal-log-timestamp') {
      promise = toggleTerminalLogTimestamp(body)
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

process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err)
  process.exit(0)
})
process.on('unhandledRejection', (err) => {
  log.error('unhandledRejection', err)
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.exit(0)
})
