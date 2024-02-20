// import zmodem from 'zmodem-ts/dist/zmodem.mjs'
import Sentry from 'zmodem-ts/dist/zsentry.js'
export class AddonZmodem {
  _disposables = []

  activate (terminal) {
    terminal.zmodemAttach = this.zmodemAttach
  }

  sendWebSocket = (octets) => {
    const { socket } = this
    if (socket && socket.readyState === WebSocket.OPEN) {
      return socket.send(new Uint8Array(octets))
    } else {
      console.error('WebSocket is not open')
    }
  }

  zmodemAttach = (ctx) => {
    this.socket = ctx.socket
    this.term = ctx.term
    this.ctx = ctx
    this.zsentry = new Sentry({
      to_terminal: (octets) => {
        if (ctx.onZmodem) {
          this.term.write(String.fromCharCode.apply(String, octets))
        }
      },
      sender: this.sendWebSocket,
      on_retract: ctx.onzmodemRetract,
      on_detect: ctx.onZmodemDetect
    })
    this.socket.binaryType = 'arraybuffer'
    this.socket.addEventListener('message', this.handleWSMessage)
  }

  handleWSMessage = (evt) => {
    if (typeof evt.data === 'string') {
      if (this.ctx.onZmodem) {
        this.term.write(evt.data)
      }
    } else {
      this.zsentry.consume(evt.data)
    }
  }

  dispose = () => {
    this.socket && this.socket.removeEventListener('message', this.handleWSMessage)
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
    this.term = null
    this.zsentry = null
    this.socket = null
  }
}
