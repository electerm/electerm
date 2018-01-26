/**
 * do file op in seprate process
 * notify though ws
 */

const {Sftp} = require('./sftp')
const {Transfer} = require('./transfer')
const {log} = require('./log')

const sftpInsts = {}
const transferInsts = {}
const parsed = (func) => {
  return (msg) => {
    func(JSON.parse(msg))
  }
}

const initWs = function (app) {

  //new sftp
  app.post('/ws/sftp-new/:id', (req, res) => {
    let {id} = req.params
    sftpInsts[id] = new Sftp()
    res.end('')
  })

  //sftp function
  app.ws('/ws/sftp-func/:id', (ws, req) => {
    let {id} = req.params
    ws.on('message', parsed((msg) => {
      let {id, args, func} = msg
      let name = 'sftp-func:' + id
      sftpInsts[id][func](...args)
        .then(res => {
          event.sender.send(name, res)
        })
        .catch(err => {
          ws.send(name, {
            message: err.message,
            stack: err.stack
          })
        })
    }))

    ws.on('close', function () {
      log('close sftp ' + id)
      // Clean things up
      delete sftpInsts[id]
    })
  })

  //new transfer
  app.post('/ws/transfer-new', async function (req, res) {
    let options = JSON.parse(req.body.q)
    let {sftpId, id} = options
    let opts = Object.assign({}, options, {
      sftp: sftpInsts[sftpId].sftp
    })
    transferInsts[id] = new Transfer(opts)
    res.end()
  })

  //transfer function
  app.ws('/ws/transfer-func/:id', (ws, req) => {
    let {id} = req.params
    let trans = transferInsts[id]
    ws.on('message', parsed((msg) => {
      let {id, args, func} = msg
      transferInsts[id][func](...args)
    }))

    ws.on('close', function () {
      log('close transfer ' + id)
      // Clean things up
      delete transferInsts[id]
    })
  })

}


ipcMain.on('transfer-new', (event, options) => {
  let {sftpId, id} = options
  let opts = Object.assign({}, options, {
    sftp: sftpInsts[sftpId].sftp
  })
  transferInsts[id] = new Transfer(opts)
  event.returnValue = ''
})

ipcMain.on('transfer-func', (event, {
  id, args, func
}) => {
  transferInsts[id][func](...args)
  if (func === 'destroy') {
    delete transferInsts[id]
  }
  event.returnValue = ''
})


