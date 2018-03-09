/**
 * communication between webview and app
 * run functions in seprate process, avoid using electron.remote directly
 */

const {Sftp} = require('./sftp')
const {Transfer} = require('./transfer')
const {fsExport: fs, syncFsFunctions} = require('./fs')

const sftpInsts = {}
const transferInsts = {}

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
}

const initWs = function (app) {

  //sftp function
  app.ws('/sftp/:id', (ws) => {
    wsDec(ws)
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
  app.ws('/transfer/:id', (ws) => {
    wsDec(ws)
    ws.on('message', (message) => {
      let msg = JSON.parse(message)
      let {action} = msg

      if (action === 'transfer-new') {
        let {sftpId, id} = msg
        let opts = Object.assign({}, msg, {
          sftp: sftpInsts[sftpId].sftp,
          ws
        })
        transferInsts[id] = new Transfer(opts)
      } else if (action === 'transfer-func') {
        let {id, func, args} = msg
        transferInsts[id][func](...args)
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
      if (syncFsFunctions.includes(func)) {
        ws.close()
        return fs[func](...args)
      }
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

}


module.exports = initWs
