/**
 * web worker
 */

function createWs (
  type,
  id,
  sessionId = '',
  sftpId = '',
  config
) {
  // init gloabl ws
  const { host, port, tokenElecterm } = config
  const wsUrl = `ws://${host}:${port}/${type}/${id}?sessionId=${sessionId}&sftpId=${sftpId}&token=${tokenElecterm}`
  const ws = new WebSocket(wsUrl)
  ws.s = msg => {
    ws.send(JSON.stringify(msg))
  }
  ws.once = (callack, id) => {
    const func = (evt) => {
      const arg = JSON.parse(evt.data)
      if (id === arg.id) {
        callack(arg)
        ws.removeEventListener('message', func)
      }
    }
    ws.addEventListener('message', func)
  }
  return new Promise((resolve) => {
    ws.onopen = () => resolve(ws)
  })
}

self.insts = {}

function send (data) {
  self.postMessage(data)
}

async function onMsg (e) {
  const {
    id,
    wsId,
    args,
    action,
    type
  } = e.data
  if (action === 'create') {
    self.insts[id] = await createWs(...args)
    send({
      action,
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
      delete self.insts[wsId]
    }
  } else if (action === 's') {
    const ws = self.insts[wsId]
    if (ws) {
      ws.s(...args)
    }
  } else if (action === 'addEventListener') {
    const ws = self.insts[wsId]
    if (ws) {
      ws.cb = (e) => {
        send({
          wsId,
          id,
          data: {
            data: e.data
          }
        })
      }
      ws.addEventListener(type, ws.cb)
    }
  } else if (action === 'removeEventListener') {
    const ws = self.insts[wsId]
    if (ws) {
      ws.removeEventListener(type, ws.cb)
      delete ws.cb
    }
  }
}

self.addEventListener('message', onMsg)
