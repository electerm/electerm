/**
 * communication between webview and app
 * run functions in seprate process, avoid using electron.remote directly
 */

const {Sftp} = require('./sftp')
const {Transfer} = require('./transfer')
const {fsExport: fs} = require('./fs')
const Upgrade = require('./download-upgrade')

const sftpInsts = {}
global.transferInsts = {}
global.upgradeInsts = {}

/**
 * add ws.s function
 * @param {*} ws
 */
const wsDec = (ws) => {
  ws.s = msg => {
    try {
      ws.send(JSON.stringify(msg))
    } catch(e) {
      console.log('ws send error')
      console.log(e)
    }
  }
  ws.on('error', e => console.log(e))
  ws._socket.setKeepAlive(true, 5 * 60 * 1000)
}

const initWs = function (app) {

  //sftp function
  app.ws('/sftp/:id', (ws, req) => {
    wsDec(ws)
    let {id} = req.params
    ws.on('close', () => {
      let inst = sftpInsts[id]
      if (inst && inst.destroy) {
        inst.destroy()
      }
      delete sftpInsts[id]
    })
    ws.on('message', (message) => {
      let msg = JSON.parse(message)
      let {action} = msg

      if (action === 'sftp-new') {
        let {id} = msg
        sftpInsts[id] = new Sftp()
      } else if (action === 'sftp-func') {
        let {id, args, func} = msg
        let uid = func + ':' + id
        sftpInsts[id][func](...args)
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
        let {id} = msg
        ws.close()
        delete sftpInsts[id]
      }
    })
    //end
  })

  //transfer function
  app.ws('/transfer/:id', (ws, req) => {
    wsDec(ws)
    let {id} = req.params
    ws.on('close', () => {
      let inst = global.transferInsts[id]
      if (inst) {
        inst.destroy()
      }
    })
    ws.on('message', (message) => {
      let msg = JSON.parse(message)
      let {action} = msg

      if (action === 'transfer-new') {
        let {sftpId, id} = msg
        let opts = Object.assign({}, msg, {
          sftp: sftpInsts[sftpId].sftp,
          ws
        })
        global.transferInsts[id] = new Transfer(opts)
      } else if (action === 'transfer-func') {
        let {id, func, args} = msg
        global.transferInsts[id][func](...args)
      }
    })
    //end
  })

  //fs function
  app.ws('/fs/:id', (ws) => {
    wsDec(ws)
    ws.on('message', (message) => {
      let msg = JSON.parse(message)
      let {id, args, func} = msg
      let uid = func + ':' + id
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
    //end
  })

  //upgrade
  app.ws('/upgrade/:id', (ws, req) => {
    wsDec(ws)
    let {id} = req.params
    ws.on('close', () => {
      let inst = global.upgradeInsts[id]
      if (inst) {
        inst.destroy()
      }
    })
    ws.on('message', async (message) => {
      let msg = JSON.parse(message)
      let {action} = msg

      if (action === 'upgrade-new') {
        let {id} = msg
        let opts = Object.assign({}, msg, {
          ws
        })
        global.upgradeInsts[id] = new Upgrade(opts)
        await global.upgradeInsts[id].init()
      } else if (action === 'upgrade-func') {
        let {id, func, args} = msg
        global.upgradeInsts[id][func](...args)
      }
    })
    //end
  })
}

module.exports = initWs
