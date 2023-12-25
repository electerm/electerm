/**
 * customize AttachAddon
 */
import { AttachAddon } from 'xterm-addon-attach'
import strip from '@electerm/strip-ansi'

export default class AttachAddonCustom extends AttachAddon {
  constructor (term, options, encode, isWindowsShell) {
    super(term, options)
    this.decoder = new TextDecoder(encode)
    this.isWindowsShell = isWindowsShell
  }

  activate (terminal) {
    const writeToTerminal = (data) => {
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
        if (terminal.parent.props.sftpPathFollowSsh && terminal.buffer.active.type !== 'alternate') {
          const {
            cwdId
          } = terminal
          const nss = str.split('\r')
          const nnss = []
          for (const str1 of nss) {
            const ns = strip(str1).trim()
            if (ns.includes(cwdId) && ns.includes('$PWD')) {
              nnss.push(str1.replace(`echo "${cwdId}$PWD"`, ''))
            } else if (
              (cwdId && ns.startsWith(cwdId))
            ) {
              delete terminal.cwdId
              const cwd = ns.replace(cwdId, '').trim()
              terminal.parent.setCwd(cwd)
              nnss.push('\x1b[2A\x1b[0J')
            } else {
              nnss.push(str1)
            }
          }
          terminal.write(nnss.join('\r'))
        } else {
          terminal.write(str)
        }
      })
      fileReader.readAsArrayBuffer(new window.Blob([data]))
    }

    const sendToServer = (data) => {
      this._sendData(data)
    }

    const trzsz = window.newTrzsz(
      writeToTerminal,
      sendToServer,
      terminal.cols,
      this.isWindowsShell
    )

    this._disposables.push(
      addSocketListener(this._socket, 'message', (ev) =>
        trzsz.processServerOutput(ev.data)
      )
    )

    if (this._bidirectional) {
      this._disposables.push(terminal.onData((data) => trzsz.processTerminalInput(data)))
      this._disposables.push(terminal.onBinary((data) => trzsz.processBinaryInput(data)))
    }

    this._disposables.push(terminal.onResize((size) => trzsz.setTerminalColumns(size.cols)))

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
