/**
 * transfer through ipc
 */

import {generate} from 'shortid'

const keys = window.getGlobal('transferKeys')
const {ipcRenderer} = window._require('electron')

export default class Transfer {

  constructor({
    onData,
    onEnd,
    onError,
    ...rest
  }) {
    let id = generate()
    this.id = id
    let th = this
    ipcRenderer.sendSync('transfer-new', {
      ...rest,
      id
    })
    keys.forEach(func => {
      th[func] = (...args) => {
        ipcRenderer.sendSync('transfer-func', {
          id: th.id,
          func,
          args
        })
        if (func === 'destroy') {
          th.onDestroy()
        }
      }
    })
    ipcRenderer.on('transfer:data:' + id, (event, arg) => {
      onData(arg)
    })
    ipcRenderer.on('transfer:end:' + id, (event, arg) => {
      onEnd(arg)
    })
    ipcRenderer.on('transfer:err:' + id, (event, arg) => {
      onError(new Error(arg))
    })
  }

  onDestroy() {
    let {id} = this
    ipcRenderer.removeAllListeners('transfer:data:' + id)
    ipcRenderer.removeAllListeners('transfer:end:' + id)
    ipcRenderer.removeAllListeners('transfer:err:' + id)
  }

}
