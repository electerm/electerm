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

  onceIds = []

  s (data) {
    send({
      action: 's',
      args: [data],
      wsId: this.id
    })
  }

  once (cb, id) {
    this.onceIds.push(id)
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

  onclose () {

  }

  clearOnces () {
    if (this.eid) {
      delete persists[this.eid]
    }
    this.onceIds.forEach(k => {
      delete onces[k]
    })
  }

  close () {
    this.onclose()
    this.clearOnces()
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
  if (wss[id]) {
    if (action === 'close') {
      wss[id].close && wss[id].close()
    }
  } else if (persists[id]) {
    persists[id].resolve(data)
  } else if (onces[id]) {
    if (action === 'create') {
      wss[id] = new Ws(id)
      onces[id].resolve(wss[id])
    } else {
      onces[id].resolve(data)
    }
    delete onces[id]
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
