/**
 * do file op in seprate process
 * notify though ws
 */

const {Sftp} = require('./sftp')
const {Transfer} = require('./transfer')
//const {log} = require('./log')

const sftpInsts = {}
const transferInsts = {}

const initWs = function (app) {

  //sftp function
  app.ws('/ws', (ws) => {
    ws.s = msg => {
      try {
        ws.send(JSON.stringify(msg))
      } catch(e) {
        console.log('ws send error')
        console.log(e)
      }

    }
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
              action,
              func,
              data
            })
          })
          .catch(err => {
            ws.s({
              id: uid,
              action,
              func,
              error: {
                message: err.message,
                stack: err.stack
              }
            })
          })
      } else if (action === 'transfer-new') {
        let {sftpId, id} = msg
        let opts = Object.assign({}, msg, {
          sftp: sftpInsts[sftpId].sftp,
          ws
        })
        transferInsts[id] = new Transfer(opts)
      } else if (action === 'transfer-func') {
        let {id, func, args} = msg
        transferInsts[id][func](...args)
      } else if (action === 'sftp-destroy') {
        let {id} = msg
        delete sftpInsts[id]
      }

    })

    //end
  })

}


module.exports = initWs
