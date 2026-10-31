/**
 * transfer through ws
 */

import generate from './uid.js'
import initWs from './ws.js'

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
      isFtp,
      port
    } = rest
    const ws = await initWs('transfer', id, sftpId, undefined, port)
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
    // A transfer socket is not persistent. When it drops, the server has
    // already torn the transfer down (session-server.js destroys it on the
    // socket's close event), so the only truthful outcome is an error: without
    // `onClose` the pending `transfer:end`/`transfer:err` entries are dropped
    // by clearOnces() and the panel shows a running transfer forever.
    // `finished` keeps that from firing on the three deliberate teardowns --
    // `transfer:end`, `transfer:err` and destroy()/cancel, all of which close
    // the socket themselves.
    const onClose = () => {
      if (th.finished) {
        return
      }
      th.finished = true
      onError(new Error('Connection lost'))
      th.onDestroy(ws)
    }
    ws.once((arg) => {
      if (th.finished) {
        return
      }
      th.finished = true
      onEnd(arg)
      th.onDestroy(ws)
    }, 'transfer:end:' + id, onClose)
    ws.once((arg) => {
      if (th.finished) {
        return
      }
      th.finished = true
      console.debug('sftp transfer error')
      console.debug(arg.error.stack)
      onError(new Error(arg.error.message))
      th.onDestroy(ws)
    }, 'transfer:err:' + id, onClose)
  }

  onDestroy (ws) {
    this.finished = true
    ws.removeEventListener('message', this.onData)
    ws.close()
  }
}

export default async (props) => {
  const transfer = new Transfer()
  await transfer.init(props)
  return transfer
}
