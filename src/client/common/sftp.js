/**
 * sftp through ipc
 */

import {generate} from 'shortid'
import Transfer from './transfer'
import {transferTypeMap} from './constants'

const keys = window.getGlobal('instSftpKeys')
const {ipcRenderer} = window._require('electron')
const transferKeys = Object.keys(transferTypeMap)

export default class Sftp {

  constructor() {
    this.id = generate()
    ipcRenderer.sendSync('sftp-new', this.id)
    let th = this
    keys.forEach(func => {
      th[func] = (...args) => {
        if (transferKeys.includes(func)) {
          return new Transfer({
            sftpId: th.id,
            ...args[0],
            type: func
          })
        }
        return new Promise((resolve, reject) => {
          ipcRenderer.send('sftp-func', {
            id: th.id,
            func,
            args
          })
          ipcRenderer.once('sftp-func:' + th.id, (event, arg) => {
            if (arg && arg.stack) {
              return reject(new Error(arg.message))
            }
            resolve(arg)
          })
        })
      }
    })
  }

  destroy() {
    ipcRenderer.send('sftp-destroy', this.id)
  }

}
