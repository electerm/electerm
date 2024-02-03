/**
 * customize AttachAddon
 */
import { AttachAddon } from 'xterm-addon-attach'
import strip from '@electerm/strip-ansi'

export default class AttachAddonCustom extends AttachAddon {
  constructor (term, socket, isWindowsShell) {
    super(socket)
    this.term = term
    this.socket = socket
    this.isWindowsShell = isWindowsShell
  }

  activate (terminal = this.term) {
    this.trzsz = window.newTrzsz(
      this.writeToTerminal,
      this.sendToServer,
      terminal.cols,
      this.isWindowsShell
    )

    this.addSocketListener(this._socket, 'message', this.onMsg)

    if (this._bidirectional) {
      this._disposables.push(terminal.onData((data) => this.trzsz.processTerminalInput(data)))
      this._disposables.push(terminal.onBinary((data) => this.trzsz.processBinaryInput(data)))
    }

    this._disposables.push(terminal.onResize((size) => this.trzsz.setTerminalColumns(size.cols)))

    this._disposables.push(this.addSocketListener(this._socket, 'close', () => this.dispose()))
    this._disposables.push(this.addSocketListener(this._socket, 'error', () => this.dispose()))
  }

  onMsg = (ev) => {
    this.trzsz.processServerOutput(ev.data)
  }

  writeToTerminal = (data) => {
    const { term } = this
    if (term.parent?.onZmodem) {
      return
    }
    if (typeof data === 'string') {
      return term.write(data)
    }
    data = new Uint8Array(data)
    const fileReader = new FileReader()
    fileReader.addEventListener('load', this.onRead)
    fileReader.readAsArrayBuffer(new window.Blob([data]))
  }

  onRead = (ev) => {
    const data = ev.target.result
    const { term } = this
    const str = this.decoder.decode(data)
    if (term.parent.props.sftpPathFollowSsh && term.buffer.active.type !== 'alternate') {
      const {
        cwdId
      } = term
      const nss = str.split('\r')
      const nnss = []
      for (const str1 of nss) {
        const ns = strip(str1).trim()
        if (ns.includes(cwdId) && ns.includes('$PWD')) {
          nnss.push(str1.replace(`echo "${cwdId}$PWD"`, ''))
        } else if (
          (cwdId && ns.startsWith(cwdId))
        ) {
          delete term.cwdId
          const cwd = ns.replace(cwdId, '').trim()
          term.parent.setCwd(cwd)
          nnss.push('\x1b[2A\x1b[0J')
        } else {
          nnss.push(str1)
        }
      }
      term.write(nnss.join('\r'))
    } else {
      term.write(str)
    }
  }

  sendToServer = (data) => {
    this._sendData(data)
  }

  addSocketListener = (socket, type, handler) => {
    socket.addEventListener(type, handler)
    return {
      dispose: () => {
        if (!handler) {
          return
        }
        socket.removeEventListener(type, handler)
      }
    }
  }

  dispose = () => {
    this.term = null
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
  }
}
