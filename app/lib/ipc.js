/**
 * ipc channels, do fs, sftp operations in  child process
 */

const {ipcMain} = require('electron')
const {Sftp} = require('./sftp')
const {Transfer} = require('./transfer')

const sftpInsts = {}
const transferInsts = {}

/**
 * new
 *
 */
ipcMain.on('sftp-new', (event, id) => {
  sftpInsts[id] = new Sftp()
  event.returnValue = ''
})

ipcMain.on('sftp-func', (event, {
  id, args, func
}) => {
  let name = 'sftp-func:' + id
  sftpInsts[id][func](...args)
    .then(res => {
      event.sender.send(name, res)
    })
    .catch(err => {
      event.sender.send(name, {
        message: err.message,
        stack: err.stack
      })
    })
})

ipcMain.on('sftp-destroy', (event, id) => {
  delete sftpInsts[id]
})

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


