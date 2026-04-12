import { loadAttachAddon } from './xterm-loader.js'

export default class AttachAddonCustom {
  constructor (term, socket, isWindowsShell) {
    this.term = term
    this.socket = socket
    this.isWindowsShell = isWindowsShell
    this.outputSuppressed = false
    this.suppressedData = []
    this.suppressTimeout = null
    this.onSuppressionEndCallback = null
    this.hasReceivedInitialData = false
    this.onInitialDataCallback = null
    this._bidirectional = true
    this._disposables = []
    this._socket = socket
    this.decoder = new TextDecoder('utf-8')
    this._lastDataTime = Date.now()
    this._lastInputTime = Date.now()
    this._keepaliveTimer = null
    this._keepaliveInterval = 3000
    this._lastOutputLine = ''
    this._passwordPromptDetected = false
    this._pendingEchoCheck = null
    this._echoCheckTimer = null
  }

  _initBase = async () => {
    const AttachAddon = await loadAttachAddon()
    const base = new AttachAddon(this._socket, { bidirectional: this._bidirectional })
    this._sendData = base._sendData.bind(base)
  }

  onInitialData = (callback) => {
    if (this.hasReceivedInitialData) {
      callback()
    } else {
      this.onInitialDataCallback = callback
    }
  }

  startOutputSuppression = (timeout = 3000, onEnd = null, discardOnTimeout = false) => {
    this.outputSuppressed = true
    this.suppressedData = []
    this.onSuppressionEndCallback = onEnd
    this.suppressTimeout = setTimeout(() => {
      if (!discardOnTimeout) {
        console.warn('[AttachAddon] Output suppression timeout reached, resuming')
      }
      this.stopOutputSuppression(discardOnTimeout)
    }, timeout)
  }

  stopOutputSuppression = (discard = true) => {
    if (this.suppressTimeout) {
      clearTimeout(this.suppressTimeout)
      this.suppressTimeout = null
    }
    this.outputSuppressed = false

    if (!discard && this.suppressedData.length > 0) {
      for (const data of this.suppressedData) {
        this.writeToTerminalDirect(data)
      }
    }
    this.suppressedData = []

    if (this.onSuppressionEndCallback) {
      const callback = this.onSuppressionEndCallback
      this.onSuppressionEndCallback = null
      callback()
    }
  }

  onShellIntegrationDetected = () => {
    if (this.outputSuppressed) {
      this.stopOutputSuppression(true)
    }
  }

  activate = async (terminal = this.term) => {
    await this._initBase()
    this.addSocketListener(this._socket, 'message', this.onMsg)

    if (this._bidirectional) {
      this._disposables.push(terminal.onData((data) => this.sendToServer(data)))
      this._disposables.push(terminal.onBinary((data) => this.sendToServer(new Uint8Array(data))))
    }

    this._disposables.push(this.addSocketListener(this._socket, 'close', () => this.dispose()))
    this._disposables.push(this.addSocketListener(this._socket, 'error', () => this.dispose()))
  }

  onMsg = (ev) => {
    this._lastDataTime = Date.now()
    if (typeof ev.data === 'string') {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.action === 'zmodem-event' || msg.action === 'trzsz-event') {
          return
        }
      } catch (e) {}
    }

    this.writeToTerminal(ev.data)
  }

  static passwordPromptPatterns = [
    /password\s*[:\]>]\s*$/i,
    /\[sudo\]\s*password\s+for\s+\S+\s*:\s*$/i,
    /enter\s+passphrase/i,
    /enter\s+password/i,
    /密码[：:]\s*$/,
    /パスワード[：:]\s*$/,
    /mot de passe\s*[:\]]\s*$/i,
    /passwort[:\]]\s*$/i,
    /contraseña[:\]]\s*$/i
  ]

  _checkPasswordPrompt = (str) => {
    // Extract last non-empty line from the output
    const lines = str.split(/\r?\n|\r/)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line) {
        this._lastOutputLine = line
        break
      }
    }
    return AttachAddonCustom.passwordPromptPatterns.some(
      p => p.test(this._lastOutputLine)
    )
  }

  _onEchoCheckTimeout = () => {
    // No echo received within timeout → confirms password mode
    this._pendingEchoCheck = null
  }

  _handleEchoDetection = (str) => {
    if (this._pendingEchoCheck) {
      // Server sent data back while we were waiting → echo is ON → not password
      if (str.includes(this._pendingEchoCheck.char)) {
        this._passwordPromptDetected = false
        clearTimeout(this._echoCheckTimer)
        this._pendingEchoCheck = null
        this._echoCheckTimer = null
        // Cancel the password dropdown if it was shown
        this.term?.parent?.onPasswordPromptCancelled?.()
      }
    }
  }

  checkForShellIntegration = (str) => {
    const ESC = String.fromCharCode(27)
    return str.includes(ESC + ']633;')
  }

  writeToTerminalDirect = (data) => {
    const { term } = this
    if (term.parent?.onZmodem) {
      return
    }
    if (typeof data === 'string') {
      return term.write(data)
    }
    term?.write(data)
  }

  writeToTerminal = (data) => {
    const { term } = this
    if (term.parent?.onZmodem) {
      return
    }

    if (!this.hasReceivedInitialData) {
      this.hasReceivedInitialData = true
      if (this.onInitialDataCallback) {
        const callback = this.onInitialDataCallback
        this.onInitialDataCallback = null
        setTimeout(callback, 0)
      }
    }

    if (this.outputSuppressed) {
      let str = data
      if (typeof data !== 'string') {
        const decoder = this.decoder || new TextDecoder('utf-8')
        try {
          str = decoder.decode(data instanceof ArrayBuffer ? data : new Uint8Array(data))
        } catch (e) {
          str = ''
        }
      }

      if (this.checkForShellIntegration(str)) {
        this.onShellIntegrationDetected()
        return
      }

      this.suppressedData.push(data)
      return
    }

    // Password prompt detection on output
    let str = data
    if (typeof data !== 'string') {
      try {
        str = this.decoder.decode(
          data instanceof ArrayBuffer ? data : new Uint8Array(data)
        )
      } catch (e) {
        str = ''
      }
    }
    this._handleEchoDetection(str)
    if (this._checkPasswordPrompt(str) && !this._passwordPromptDetected) {
      this._passwordPromptDetected = true
      // Show password dropdown immediately after terminal renders the prompt
      setTimeout(() => {
        this.term?.parent?.onPasswordPromptDetected?.()
      }, 100)
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
    term?.write(str)
  }

  sendToServer = (data) => {
    this._lastInputTime = Date.now()
    // Start echo detection when password prompt is suspected
    if (this._passwordPromptDetected && !this._pendingEchoCheck && data !== '\r' && data !== '\n') {
      this._pendingEchoCheck = { char: data, time: Date.now() }
      clearTimeout(this._echoCheckTimer)
      this._echoCheckTimer = setTimeout(this._onEchoCheckTimeout, 200)
    }
    // Reset password state on Enter
    if (data === '\r' || data === '\n') {
      this._passwordPromptDetected = false
      this._lastOutputLine = ''
      this._pendingEchoCheck = null
      clearTimeout(this._echoCheckTimer)
      this._echoCheckTimer = null
    }
    this._sendData(data)
  }

  _startKeepalive = () => {
    this._stopKeepalive()
    this._keepaliveTimer = setInterval(this._checkKeepalive, this._keepaliveInterval)
  }

  _stopKeepalive = () => {
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer)
      this._keepaliveTimer = null
    }
  }

  _checkKeepalive = () => {
    if (this.outputSuppressed) {
      return
    }
    const now = Date.now()
    const idleSinceData = now - this._lastDataTime
    const idleSinceInput = now - this._lastInputTime
    if (idleSinceData >= this._keepaliveInterval && idleSinceInput >= this._keepaliveInterval) {
      // Tell the server to write \n to the PTY so bash's read() wakes up and
      // resets the TMOUT alarm. The user has explicitly enabled keepalive and
      // accepts the side-effect of an occasional echoed newline / re-prompt.
      // Start output suppression to hide the echoed prompt.
      const sock = this._socket
      if (sock && sock.readyState === 1 /* OPEN */) {
        this.startOutputSuppression(500, null, true)
        sock.send(JSON.stringify({ action: 'keepalive' }))
      }
    }
  }

  setKeepalive = (enabled) => {
    if (enabled) {
      this._startKeepalive()
    } else {
      this._stopKeepalive()
    }
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
    this._stopKeepalive()
    clearTimeout(this._echoCheckTimer)
    this._echoCheckTimer = null
    this.term = null
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
  }
}
