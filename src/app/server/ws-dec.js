/**
 * add ws.s function
 * @param {*} ws
 */

const log = require('../common/log')

const wsDec = (ws) => {
  ws.s = msg => {
    try {
      ws.send(JSON.stringify(msg))
    } catch (e) {
      log.error('ws send error')
      log.error(e)
    }
  }
  ws.on('error', log.error)
  // Returns a disposer: a prompt can be taken back before it is ever answered,
  // and the listener would otherwise sit on the long-lived ws forever.
  ws.once = (callack, id) => {
    const func = (evt) => {
      const arg = JSON.parse(evt.data)
      if (id === arg.id) {
        callack(arg)
        ws.removeEventListener('message', func)
      }
    }
    ws.addEventListener('message', func)
    return () => ws.removeEventListener('message', func)
  }
  ws._socket.setKeepAlive(true, 30 * 1000)
}

module.exports = wsDec
