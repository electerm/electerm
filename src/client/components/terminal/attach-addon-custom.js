/**
 * customize AttachAddon
 */
import { AttachAddon } from '@xterm/addon-attach'

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
    // When in alternate screen mode (like vim, less, or TUI apps like Claude Code),
    // bypass trzsz processing to avoid interference with the application's display
    if (this.term?.buffer?.active?.type === 'alternate') {
      this.writeToTerminal(ev.data)
    } else {
      this.trzsz.processServerOutput(ev.data)
    }
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
    term?.parent?.notifyOnData()
    const str = this.decoder.decode(data)
    // CWD tracking is now handled by shell integration automatically
    // No need to parse PS1 markers
    term?.write(str)
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
