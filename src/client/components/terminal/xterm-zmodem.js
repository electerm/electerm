import zmodem from 'zmodem.js/src/zmodem_browser'

function zmodemAttach (ws, opts, ctx) {
  if (opts === void 0) { opts = {} }
  const term = this
  const senderFunc = function (octets) { return ws.send(new Uint8Array(octets)) }
  let zsentry = null
  function shouldWrite () {
    return !!zsentry.get_confirmed_session() || !opts.noTerminalWriteOutsideSession
  }
  zsentry = new zmodem.Sentry({
    to_terminal: function (octets) {
      if (shouldWrite()) {
        term.write(String.fromCharCode.apply(String, octets))
      }
    },
    sender: senderFunc,
    on_retract: ctx.onzmodemRetract,
    on_detect: ctx.onZmodemDetect
  })
  function handleWSMessage (evt) {
    if (typeof evt.data === 'string') {
      if (shouldWrite()) {
        term.write(evt.data)
      }
    } else {
      zsentry.consume(evt.data)
    }
  }
  ws.binaryType = 'arraybuffer'
  ws.addEventListener('message', handleWSMessage)
}

export class AddonZmodem {
  _disposables = []

  activate (terminal) {
    terminal.zmodemAttach = zmodemAttach
    terminal.zmodemBrowser = zmodem.Browser
  }

  dispose () {
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
  }
}

export const Zmodem = zmodem
