/**
 * ws function for sftp/file transfer communication
 */

import { nanoid as generate } from 'nanoid/non-secure'
import wait from './wait'
import copy from 'json-deep-copy'

const onces = {}
const wss = {}
const persists = {}

function send (data) {
  window.worker.postMessage(data)
}

class Ws {
  constructor (id, persist) {
    this.id = id
    this.persist = !!persist
  }

  onceIds = []

  s (data) {
    send({
      action: 's',
      args: [data],
      wsId: this.id
    })
  }

  async once (func, id) {
    while (this.closed) {
      await wait(100)
    }
    this.onceIds.push(id)
    onces[id] = {
      resolve: (...args) => {
        func(...args)
        delete onces[id]
        this.onceIds = this.onceIds.filter(d => d !== id)
      }
    }
    send({
      id,
      wsId: this.id,
      action: 'once'
    })
  }

  addEventListener (type = 'message', cb = this.cb) {
    this.cb = cb
    const id = this.eid || generate()
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
    const ids = copy(this.onceIds)
    ids.forEach(k => {
      delete onces[k]
    })
    this.onceIds = []
  }

  close () {
    this.onclose()
    if (this.persist) {
      this.closed = true
      return
    }
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
    action,
    persist
  } = e.data
  if (wss[id]) {
    if (action === 'close') {
      wss[id].close && wss[id].close()
    }
  }
  if (persists[id]) {
    persists[id].resolve(data)
  } else if (onces[id]) {
    if (action === 'create') {
      if (!wss[id]) {
        wss[id] = new Ws(id, persist)
      } else {
        wss[id].addEventListener()
        wss[id].closed = false
      }
      onces[id].resolve(wss[id])
    } else {
      onces[id].resolve(data)
    }
    delete onces[id]
  }
}

window.worker.addEventListener('message', onEvent)

export default (type, id, sessionId = '', sftpId = '', persist) => {
  return new Promise((resolve) => {
    send({
      id,
      action: 'create',
      persist,
      type,
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
