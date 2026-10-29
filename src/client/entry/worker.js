/**
 * web worker
 */

self.insts = {}

function createWs (
  type,
  id,
  sftpId = '',
  config
) {
  // init gloabl ws
  const { host, port, tokenElecterm } = config
  const wsUrl = `ws://${host}:${port}/${type}/${id}?&sftpId=${sftpId}&token=${tokenElecterm}`
  const ws = new WebSocket(wsUrl)
  ws.s = msg => {
    try {
      ws.send(JSON.stringify(msg))
    } catch (e) {
      console.error('ws send error', e)
    }
  }
  ws.id = id
  // One shared `message` listener that dispatches by id, attached only while at
  // least one call is pending. It used to add a listener per pending call and
  // JSON.parse the payload inside each of them, so K concurrent calls made every
  // incoming message be parsed K times (O(K^2) per burst). Listing a folder fired
  // ~2 calls per directory entry (stat + lstat, see getLocalFileInfo), so a few
  // thousand entries meant tens of millions of parses and a multi-second freeze.
  // The list is now a single batched call, but any future burst benefits from
  // the linear dispatch.
  ws.onceCbs = new Map()
  const onOnceMessage = evt => {
    const arg = JSON.parse(evt.data)
    const cb = ws.onceCbs.get(arg.id)
    if (!cb) {
      return
    }
    ws.onceCbs.delete(arg.id)
    if (ws.onceCbs.size === 0) {
      ws.removeEventListener('message', onOnceMessage)
    }
    cb(arg)
  }
  const dropOnces = () => {
    ws.onceCbs.clear()
    ws.removeEventListener('message', onOnceMessage)
  }
  ws.once = (callback, id) => {
    if (ws.onceCbs.size === 0) {
      ws.addEventListener('message', onOnceMessage)
    }
    ws.onceCbs.set(id, callback)
  }
  ws.onclose = () => {
    // A dead socket will never answer its pending calls; the caller side has
    // already settled them as errors. Drop the callbacks and the shared
    // listener so a socket that is closed and revived (persist sockets) does
    // not keep parsing every incoming message for nobody.
    dropOnces()
    if (ws.dup) {
      return
    }
    send({
      id: ws.id,
      action: 'close'
    })
    delete self.insts[ws.id]
  }
  return new Promise((resolve) => {
    ws.onopen = () => {
      if (self.insts[ws.id]) {
        ws.dup = true
        ws.close()
        resolve(null)
      } else {
        resolve(ws)
      }
    }
  })
}

function send (data) {
  self.postMessage(data)
}

async function onMsg (e) {
  const {
    id,
    wsId,
    args,
    action,
    type,
    persist
  } = e.data
  if (action === 'create') {
    const inst = self.insts[id]
    if (inst instanceof WebSocket) {
      return send({
        action,
        id,
        persist
      }, '*')
    } else if (inst) {
      return false
    } else {
      const ws = await createWs(...args)
      if (ws) {
        self.insts[id] = ws
      }
    }
    send({
      action,
      persist,
      id
    }, '*')
  } else if (action === 'once') {
    const ws = self.insts[wsId]
    if (ws) {
      const cb = (data) => {
        send({
          id,
          wsId,
          data
        })
      }
      ws.once(cb, id)
    }
  } else if (action === 'close') {
    const ws = self.insts[wsId]
    if (ws) {
      ws.close()
    }
  } else if (action === 's') {
    const ws = self.insts[wsId]
    if (ws) {
      ws.s(...args)
    }
  } else if (action === 'addEventListener') {
    const ws = self.insts[wsId]
    if (ws) {
      if (!ws.cbs) {
        ws.cbs = {}
      }
      const cb = (e) => {
        send({
          wsId,
          id,
          data: {
            data: e.data
          }
        })
      }
      ws.cbs[id] = cb
      ws.addEventListener(type, cb)
    }
  } else if (action === 'removeEventListener') {
    const ws = self.insts[wsId]
    if (ws && ws.cbs && ws.cbs[id]) {
      ws.removeEventListener(type, ws.cbs[id])
      delete ws.cbs[id]
    }
  }
}

self.addEventListener('message', onMsg)
setTimeout(() => {
  send({
    action: 'worker-init'
  })
}, 10)
