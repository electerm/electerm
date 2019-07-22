/**
 * ws function for sftp/file transfer communication
 */

export default (type, id) => {
  // init gloabl ws
  const { host, port } = window._config
  const wsUrl = `ws://${host}:${port}/${type}/${id}`
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
