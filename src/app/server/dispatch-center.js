/**
 * communication between webview and app
 * run functions in seprate process, avoid using electron.remote directly
 */

const { Terminal: Sftp } = require('./session')
const {
  sftp,
  transfer,
  onDestroySftp,
  onDestroyTransfer
} = require('./remote-common')
const { Transfer } = require('./transfer')
const { fsExport: fs } = require('../lib/fs')
const log = require('../utils/log')
const Upgrade = require('./download-upgrade')
const fetch = require('./fetch')

global.upgradeInsts = {}

// for remote sessions
global.sessions = {}

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
  ws._socket.setKeepAlive(true, 5 * 60 * 1000)
}

const initWs = function (app) {
  // sftp function
  app.ws('/sftp/:id', (ws, req) => {
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
        sftp(id, sessionId)[func](...args)
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

  // fs function
  app.ws('/fs/:id', (ws) => {
    wsDec(ws)
    ws.on('message', (message) => {
      const msg = JSON.parse(message)
      const { id, args, func } = msg
      const uid = func + ':' + id
      fs[func](...args)
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
    })
    // end
  })

  // upgrade
  app.ws('/upgrade/:id', (ws, req) => {
    wsDec(ws)
    const { id } = req.params
    ws.on('close', () => {
      const inst = global.upgradeInsts[id]
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
        global.upgradeInsts[id] = new Upgrade(opts)
        await global.upgradeInsts[id].init()
      } else if (action === 'upgrade-func') {
        const { id, func, args } = msg
        global.upgradeInsts[id][func](...args)
      }
    })
  })

  // upgrade
  app.ws('/fetch/s', (ws, req) => {
    wsDec(ws)
    ws.on('message', async (message) => {
      const msg = JSON.parse(message)
      const { id, options } = msg
      const res = await fetch(options)
      if (res.error) {
        ws.s({
          error: res.error,
          id
        })
      } else {
        ws.s({
          data: res,
          id
        })
      }
    })
  })
  // end
}

module.exports = initWs
