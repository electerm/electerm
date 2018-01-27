/**
 * ws function for sftp/file transfer communication
 */

export default () => {
  //init gloabl ws
  let {host, port} = window.getGlobal('_config')
  let wsUrl = `ws://${host}:${port}/ws`
  let ws = new WebSocket(wsUrl)
  ws.s = msg => {
    ws.send(JSON.stringify(msg))
  }
  ws.once = (callack, id) => {
    let func = (evt) => {
      let arg = JSON.parse(evt.data)
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
