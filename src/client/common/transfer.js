/**
 * transfer through ws
 */

import generate from './uid'
import initWs from './ws'

const keys = window.pre.transferKeys

class Transfer {
  async init ({
    onData,
    onEnd,
    onError,
    ...rest
  }) {
    const id = generate()
    this.id = id
    const th = this
    const {
      sftpId,
      isFtp
    } = rest
    const ws = await initWs('transfer', id, sftpId)
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
          isFtp,
          func,
          sftpId,
          args
        })
        if (func === 'destroy') {
          th.onDestroy(ws)
        }
      }
    })

    const did = 'transfer:data:' + id
    this.onData = (evt) => {
      const arg = JSON.parse(evt.data)
      if (did === arg.id) {
        onData(arg.data)
      }
    }
    ws.addEventListener('message', this.onData)
    ws.once((arg) => {
      onEnd(arg)
      th.onDestroy(ws)
    }, 'transfer:end:' + id)
    ws.once((arg) => {
      log.debug('sftp transfer error')
      log.debug(arg.error.stack)
      onError(new Error(arg.error.message))
      th.onDestroy(ws)
    }, 'transfer:err:' + id)
  }

  onDestroy (ws) {
    ws.removeEventListener('message', this.onData)
    ws.close()
  }
}

export default async (props) => {
  const transfer = new Transfer()
  await transfer.init(props)
  return transfer
}
