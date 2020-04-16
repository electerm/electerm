/**
 * customize AttachAddon
 */
import { AttachAddon } from 'xterm-addon-attach'

export default class AttachAddonCustom extends AttachAddon {
  constructor (term, options, encode) {
    super(term, options)
    this.decoder = new TextDecoder(encode)
  }

  activate (terminal) {
    this._disposables.push(
      addSocketListener(this._socket, 'message', ev => {
        let { data } = ev
        if (typeof data === 'string') {
          return terminal.write(data)
        }
        data = new Uint8Array(data)
        if (!this.decoder) {
          return terminal.write(data)
        }
        const fileReader = new FileReader()
        fileReader.addEventListener('load', () => {
          const str = this.decoder.decode(fileReader.result)
          terminal.write(str)
        })
        fileReader.readAsArrayBuffer(new window.Blob([data]))
      })
    )

    if (this._bidirectional) {
      this._disposables.push(terminal.onData(data => this._sendData(data)))
      this._disposables.push(terminal.onBinary(data => this._sendBinary(data)))
    }

    this._disposables.push(addSocketListener(this._socket, 'close', () => this.dispose()))
    this._disposables.push(addSocketListener(this._socket, 'error', () => this.dispose()))
  }
}

function addSocketListener (socket, type, handler) {
  socket.addEventListener(type, handler)
  return {
    dispose: () => {
      if (!handler) {
        // Already disposed
        return
      }
      socket.removeEventListener(type, handler)
    }
  }
}
