/**
 * ws function for sftp/file transfer communication
 */

import { nanoid as generate } from 'nanoid/non-secure'

const onces = {}
const wss = {}
const persists = {}

function send (data) {
  window.worker.postMessage(data)
}

class Ws {
  constructor (id) {
    this.id = id
  }

  s (data) {
    send({
      action: 's',
      args: [data],
      wsId: this.id
    })
  }

  once (cb, id) {
    onces[id] = {
      resolve: cb
    }
    send({
      id,
      wsId: this.id,
      action: 'once'
    })
  }

  addEventListener (type, cb) {
    const id = generate()
    this.eid = id
    persists[id] = {
      resolve: cb
    }
    send({
      id,
      wsId: this.id,
      type,
      action: 'addEventListener'
    })
  }

  removeEventListener (type, cb) {
    delete persists[this.eid]
    send({
      id: this.eid,
      wsId: this.id,
      type,
      action: 'removeEventListener'
    })
  }

  close () {
    send({
      action: 'close',
      wsId: this.id
    })
    delete wss[this.id]
  }
}

function onEvent (e) {
  if (!e || !e.data) {
    return false
  }
  const {
    id,
    data,
    action
  } = e.data
  if (onces[id]) {
    if (action === 'create') {
      wss[id] = new Ws(id)
      return onces[id].resolve(wss[id])
    } else {
      onces[id].resolve(data)
    }
    delete onces[id]
  } else if (persists[id]) {
    persists[id].resolve(data)
  }
}

window.worker.addEventListener('message', onEvent)

export default (type, id, sessionId = '', sftpId = '') => {
  return new Promise((resolve) => {
    send({
      id,
      action: 'create',
      args: [
        type,
        id,
        sessionId,
        sftpId,
        window._config
      ]
    })
    onces[id] = {
      resolve
    }
  })
}
