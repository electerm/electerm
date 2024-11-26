/**
 * communication between webview and app
 * run functions in seprate process, avoid using electron.remote directly
 */

const { Sftp } = require('./session-sftp')
const {
  sftp,
  transfer,
  onDestroySftp,
  onDestroyTransfer
} = require('./remote-common')
const { Transfer } = require('./transfer')
const fs = require('./fs')
const log = require('../common/log')
const { Upgrade } = require('./download-upgrade')
const fetch = require('./fetch')
const sync = require('./sync')
const {
  createTerm,
  testTerm,
  resize,
  runCmd,
  toggleTerminalLog,
  toggleTerminalLogTimestamp
} = require('./terminal-api')
const globalState = require('./global-state')

const { tokenElecterm } = process.env

/**
 * add ws.s function
 * @param {*} ws
 */
const wsDec = (ws) => {
  ws.s = msg => {
    try {
      ws.send(JSON.stringify(msg))
    } catch (e) {
      log.error('ws send error')
      log.error(e)
    }
  }
  ws.on('error', log.error)
  ws.once = (callack, id) => {
    const func = (evt) => {
      const arg = JSON.parse(evt.data)
      if (id === arg.id) {
        callack(arg)
        ws.removeEventListener('message', func)
      }
    }
    ws.addEventListener('message', func)
  }
  ws._socket.setKeepAlive(true, 30 * 1000)
}

function verify (req) {
  const { token: to } = req.query
  if (to !== tokenElecterm) {
    throw new Error('not valid request')
  }
  if (process.env.requireAuth === 'yes' && !globalState.authed) {
    throw new Error('auth required')
  }
}

const initWs = function (app) {
  // sftp function
  app.ws('/sftp/:id', (ws, req) => {
    verify(req)
    wsDec(ws)
    const { id } = req.params
    const { sessionId } = req.query
    ws.on('close', () => {
      onDestroySftp(id, sessionId)
    })
    ws.on('message', (message) => {
      const msg = JSON.parse(message)
      const { action } = msg

      if (action === 'sftp-new') {
        const { id, sessionId } = msg
        sftp(id, sessionId, new Sftp({
          uid: id,
          sessionId,
          type: 'sftp'
        }))
      } else if (action === 'sftp-func') {
        const { id, args, func, sessionId } = msg
        const uid = func + ':' + id
        const inst = sftp(id, sessionId)
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
        const { id, sessionId } = msg
        ws.close()
        onDestroySftp(id, sessionId)
      }
    })
    // end
  })

  // transfer function
  app.ws('/transfer/:id', (ws, req) => {
    verify(req)
    wsDec(ws)
    const { id } = req.params
    const { sessionId, sftpId } = req.query
    ws.on('close', () => {
      onDestroyTransfer(id, sftpId, sessionId)
    })
    ws.on('message', (message) => {
      const msg = JSON.parse(message)
      const { action } = msg

      if (action === 'transfer-new') {
        const { sftpId, id, sessionId } = msg
        const opts = Object.assign({}, msg, {
          sftp: sftp(sftpId, sessionId).sftp,
          sftpId,
          sessionId,
          ws
        })
        transfer(id, sftpId, sessionId, new Transfer(opts))
      } else if (action === 'transfer-func') {
        const { id, func, args, sftpId, sessionId } = msg
        if (func === 'destroy') {
          return onDestroyTransfer(id, sftpId, sessionId)
        }
        transfer(id, sftpId, sessionId)[func](...args)
      }
    })
    // end
  })

  // upgrade
  app.ws('/upgrade/:id', (ws, req) => {
    verify(req)
    wsDec(ws)
    const { id } = req.params
    ws.on('close', () => {
      const inst = globalState.getUpgradeInst(id)
      if (inst) {
        inst.destroy()
      }
    })
    ws.on('message', async (message) => {
      const msg = JSON.parse(message)
      const { action } = msg

      if (action === 'upgrade-new') {
        const { id } = msg
        const opts = Object.assign({}, msg, {
          ws
        })
        const inst = new Upgrade(opts)
        globalState.setUpgradeInst(id, inst)
        await inst.init()
      } else if (action === 'upgrade-func') {
        const { id, func, args } = msg
        globalState.getUpgradeInst(id)[func](...args)
      }
    })
  })

  // common functions
  app.ws('/common/s', (ws, req) => {
    verify(req)
    wsDec(ws)
    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message)
        const { action } = msg
        if (action === 'fetch') {
          fetch(ws, msg)
        } else if (action === 'sync') {
          sync(ws, msg)
        } else if (action === 'fs') {
          fs(ws, msg)
        } else if (action === 'create-terminal') {
          createTerm(ws, msg)
        } else if (action === 'test-terminal') {
          testTerm(ws, msg)
        } else if (action === 'resize-terminal') {
          resize(ws, msg)
        } else if (action === 'toggle-terminal-log') {
          toggleTerminalLog(ws, msg)
        } else if (action === 'toggle-terminal-log-timestamp') {
          toggleTerminalLogTimestamp(ws, msg)
        } else if (action === 'run-cmd') {
          runCmd(ws, msg)
        }
      } catch (err) {
        log.error('common ws error', err)
      }
    })
  })
  // end
}

exports.verifyWs = verify
exports.initWs = initWs
