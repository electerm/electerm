/**
 * transfer through ws
 */

import {generate} from 'shortid'
import initWs from './ws'

const keys = window.getGlobal('transferKeys')

class Transfer {

  constructor() {}

  async init ({
    onData,
    onEnd,
    onError,
    ...rest
  }) {
    let id = generate()
    this.id = id
    let th = this
    let ws = await initWs('transfer', id)
    ws.s({
      action: 'transfer-new',
      ...rest,
      id
    })
    keys.forEach(func => {
      th[func] = (...args) => {
        ws.s({
          action: 'transfer-func',
          id: th.id,
          func,
          args
        })
        if (func === 'destroy') {
          th.onDestroy(ws)
        }
      }
    })

    let did = 'transfer:data:' + id
    this.onData = (evt) => {
      let arg = JSON.parse(evt.data)
      if (did === arg.id) {
        onData(arg.data)
      }
    }
    ws.addEventListener('message', this.onData)
    ws.once((arg) => {
      onEnd(arg)
    }, 'transfer:end:' + id)
    ws.once((arg) => {
      console.log('sftp transfer error')
      console.log(arg.error.stack)
      onError(new Error(arg.error.message))
    }, 'transfer:err:' + id)

  }

  onDestroy(ws) {
    ws.removeEventListener('message', this.onData)
    ws.close()
  }

}

export default async (props) => {
  let transfer = new Transfer()
  await transfer.init(props)
  return transfer
}
