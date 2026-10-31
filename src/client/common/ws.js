/**
 * ws function for sftp/file transfer communication
 */

import generate from './uid.js'
import wait from './wait.js'
import { pick } from 'lodash-es'

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

  // `onClose` is optional: called if the socket goes away before the answer
  // arrives. Without it the caller's promise is dropped by clearOnces() and
  // never settles -- the UI shows a spinner forever.
  async once (func, id, onClose) {
    const maxWait = 300
    let waited = 0
    while (this.closed) {
      if (++waited >= maxWait) {
        console.warn('ws once timeout waiting for reconnection', id)
        return
      }
      await wait(100)
    }
    this.onceIds.push(id)
    onces[id] = {
      resolve: (...args) => {
        func(...args)
        delete onces[id]
        this.onceIds = this.onceIds.filter(d => d !== id)
      },
      reject: (err) => {
        onClose && onClose(err)
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
    const id = generate()
    if (!this.eids) {
      this.eids = new Set()
    }
    if (!this.cbToId) {
      this.cbToId = new Map()
    }
    this.eids.add(id)
    this.cbToId.set(cb, id)
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
    if (!this.cbToId || !this.cbToId.has(cb)) {
      return
    }
    const id = this.cbToId.get(cb)
    this.cbToId.delete(cb)
    this.eids.delete(id)
    delete persists[id]
    send({
      id,
      wsId: this.id,
      type,
      action: 'removeEventListener'
    })
  }

  onclose () {

  }

  clearOnces () {
    if (this.eids) {
      for (const eid of this.eids) {
        delete persists[eid]
      }
      this.eids.clear()
    }
    if (this.cbToId) {
      this.cbToId.clear()
    }
    const ids = [...this.onceIds]
    ids.forEach(k => {
      const pending = onces[k]
      // A pending request can no longer be answered on a dead socket. Settle it
      // as an error instead of deleting it: a deleted entry leaves the caller's
      // promise pending forever (the sftp panel and the AI agent both await it).
      if (pending && pending.reject) {
        pending.reject(new Error('Connection closed before the request completed'))
      }
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
  if (wss[id] && action === 'close') {
    const ws = wss[id]
    ws.onclose()
    if (ws.persist) {
      ws.closed = true
    } else {
      ws.clearOnces()
      delete wss[id]
    }
    return
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

export default (type, id, sftpId = '', persist, port) => {
  const opts = pick(window.store.config, [
    'host',
    'port',
    'tokenElecterm',
    'server',
    'urlPath'
  ])
  if (port) {
    opts.port = port
  }
  return new Promise((resolve) => {
    send({
      id,
      action: 'create',
      persist,
      type,
      args: [
        type,
        id,
        sftpId,
        opts
      ]
    })
    onces[id] = {
      resolve
    }
  })
}
