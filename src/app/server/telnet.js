// from https://github.com/mkozjak/node-telnet-client
const { EventEmitter } = require('events')
const { Socket, createConnection } = require('net')
const { Duplex } = require('stream')

function search (str, pattern) {
  if (!str || !pattern) { return -1 } else if (pattern instanceof RegExp) { return str.search(pattern) } else { return str.indexOf(pattern) }
}

class Stream extends Duplex {
  constructor (source, options) {
    super(options)
    this.source = source
    this.source.on('data', data => this.push(data))
  }

  _write (data, encoding, callback) {
    if (!this.source.writable && callback) {
      callback(new Error('socket not writable'))
    }
    this.source.write(data, encoding, callback)
  }

  _read () { }
}

const defaultOptions = {
  debug: false,
  echoLines: 1,
  encoding: 'ascii',
  execTimeout: 2000,
  host: '127.0.0.1',
  initialCtrlC: false,
  initialLFCR: false,
  irs: '\r\n',
  localAddress: '',
  loginPrompt: /login[: ]*$/i,
  maxBufferLength: 1048576,
  maxEndWait: 250,
  negotiationMandatory: true,
  ors: '\n',
  pageSeparator: '---- More',
  password: 'guest',
  passwordPrompt: /password[: ]*$/i,
  port: 23,
  sendTimeout: 2000,
  shellPrompt: /(?:\/ )?#\s/,
  stripControls: false,
  stripShellPrompt: true,
  timeout: 2000,
  username: 'root'
}

// Convert various options which can be provided as strings into regexes.
function stringToRegex (opts) {
  ['failedLoginMatch', 'loginPrompt', 'passwordPrompt', 'shellPrompt'].forEach(key => {
    const value = opts[key]
    opts[key] = typeof value === 'string' ? new RegExp(value) : value
  })
}
class Telnet extends EventEmitter {
  constructor (options) {
    super()
    this.endEmitted = false
    this.inputBuffer = ''
    this.loginPromptReceived = false
    this.opts = Object.assign({}, defaultOptions, options)
    this.pendingData = []
    this.response = []
    this.socket = new Socket()
    this.state = null
    this.on('data', data => this.pushNextData(data))
    this.on('end', () => {
      this.pushNextData(null)
      this.state = 'end'
    })
  }

  pushNextData (data) {
    if (data instanceof Buffer) { data = data.toString(this.opts.encoding) } else if (data != null) { data = data.toString() }
    const chunks = data ? data.split(/(?<=\r\r\n|\r?\n)/) : [data]
    if (this.dataResolver) {
      this.dataResolver(chunks[0])
      this.dataResolver = undefined
    } else { this.pendingData.push(chunks[0]) }
    if (chunks.length > 1) { this.pendingData.push(...chunks.slice(1)) }
  }

  connect (opts) {
    return new Promise((resolve, reject) => {
      let connectionPending = true
      const rejectIt = (reason) => { connectionPending = false; reject(reason) }
      const resolveIt = () => { connectionPending = false; resolve() }
      Object.assign(this.opts, opts ?? {})
      this.opts.initialCtrlC = opts.initialCtrlC && this.opts.initialCTRLC
      this.opts.extSock = opts?.sock ?? this.opts.extSock
      stringToRegex(this.opts)
      // If socket is provided and in good state, just reuse it.
      if (this.opts.extSock) {
        if (!Telnet.checkSocket(this.opts.extSock)) { return rejectIt(new Error('socket invalid')) }
        this.socket = this.opts.extSock
        this.state = 'ready'
        this.emit('ready')
        resolveIt()
      } else {
        this.socket = (0, createConnection)({
          port: this.opts.port,
          host: this.opts.host,
          localAddress: this.opts.localAddress,
          ...this.opts.socketConnectOptions
        }, () => {
          this.state = 'start'
          this.emit('connect')
          if (this.opts.initialCtrlC === true) {
            this.socket.write('\x03')
          }
          if (this.opts.initialLFCR === true) {
            this.socket.write('\r\n')
          }
          if (!this.opts.negotiationMandatory) { resolveIt() }
        })
      }
      const socket = this.socket
      socket.setMaxListeners(Math.max(15, socket.getMaxListeners()))
      socket.setTimeout(this.opts.timeout || 0, () => {
        if (connectionPending) {
          // If cannot connect, emit error and destroy.
          if (this.listeners('error').length > 0) { this.emit('error', 'Cannot connect') }
          socket.destroy()
          return reject(new Error('Cannot connect'))
        }
        this.emit('timeout')
        return reject(new Error('timeout'))
      })
      socket.on('connect', () => {
        if (!this.opts.shellPrompt) {
          this.state = 'standby'
          resolveIt()
        }
      })
      socket.on('data', data => {
        let emitted = false
        if (this.state === 'standby' || !this.opts.negotiationMandatory) {
          this.emit('data', this.opts.newlineReplace ? Buffer.from(this.decode(data), this.opts.encoding) : data)
          emitted = true
        }
        const isReady = []
        if ((data = this.parseData(data, isReady)) && connectionPending && (isReady[0] || !this.opts.shellPrompt)) {
          resolveIt()
          if (!this.opts.shellPrompt && !emitted) { this.emit('data', data) }
        }
      })
      socket.on('error', error => {
        if (this.listeners('error').length > 0) { this.emit('error', error) }
        if (connectionPending) { rejectIt(error) }
      })
      socket.on('end', () => {
        if (!this.endEmitted) {
          this.endEmitted = true
          this.emit('end')
        }
        if (connectionPending) {
          if (this.state === 'start') { resolveIt() } else { rejectIt(new Error('Socket ends')) }
        }
      })
      socket.on('close', () => {
        this.emit('close')
        if (connectionPending) {
          if (this.state === 'start') { resolveIt() } else { rejectIt(new Error('Socket closes')) }
        }
      })
      this.once('failedlogin', () => {
        if (connectionPending) { rejectIt(new Error('Failed login')) }
      })
    })
  }

  shell (opts) {
    return new Stream(this.socket, opts)
  }

  end () {
    if (!this.endEmitted) {
      this.endEmitted = true
      this.emit('end')
    }
    this.socket.end()
  }

  destroy () {
    this.socket.destroy()
  }

  parseData (chunk, isReady) {
    if (chunk[0] === 255 && chunk[1] !== 255) { chunk = this.negotiate(chunk) }
    if (this.state === 'start') { this.state = 'getprompt' }
    if (this.state === 'getprompt') {
      const stringData = this.decode(chunk)
      const promptIndex = (0, search)(stringData, this.opts.shellPrompt)
      if ((0, search)(stringData, this.opts.loginPrompt) >= 0) {
        // Make sure we don't end up in an infinite loop.
        if (!this.loginPromptReceived) {
          this.state = 'login'
          this.login('username')
          this.loginPromptReceived = true
        }
      } else if ((0, search)(stringData, this.opts.passwordPrompt) >= 0) {
        this.state = 'login'
        this.login('password')
      } else if ((0, search)(stringData, this.opts.failedLoginMatch) >= 0) {
        this.state = 'failedlogin'
        this.emit('failedlogin', stringData)
        this.destroy()
      } else if (promptIndex >= 0) {
        const shellPrompt = this.opts.shellPrompt instanceof RegExp
          ? stringData.substring(promptIndex)
          : this.opts.shellPrompt
        this.state = 'standby'
        this.inputBuffer = ''
        this.loginPromptReceived = false
        this.emit('ready', shellPrompt)
      }
    } else if (this.state === 'response') {
      if (this.inputBuffer.length >= (this.opts.maxBufferLength || 0)) {
        this.emit('bufferexceeded')
        return Buffer.from(this.inputBuffer, this.opts.encoding)
      }
      const stringData = this.decode(chunk)
      this.inputBuffer += stringData
      const promptIndex = (0, search)(this.inputBuffer, this.opts.shellPrompt)
      if (promptIndex < 0 && stringData?.length > 0) {
        if ((0, search)(stringData, this.opts.pageSeparator) >= 0) { this.socket.write(Buffer.from('20', 'hex')) }
        return Buffer.from('')
      }
      const response = this.inputBuffer.split(this.opts.irs)
      for (let i = response.length - 1; i >= 0; --i) {
        if ((0, search)(response[i], this.opts.pageSeparator) >= 0) {
          response[i] = response[i].replace(this.opts.pageSeparator, '')
          if (response[i].length === 0) { response.splice(i, 1) }
        }
      }
      if (this.opts.echoLines === 1) {
        response.shift()
      } else if ((this.opts.echoLines || 0) > 1) { response.splice(0, this.opts.echoLines) } else if ((this.opts.echoLines || 0) < 0) { response.splice(0, response.length - 2) }
      // Remove prompt.
      if (this.opts.stripShellPrompt && response.length > 0) {
        const idx = response.length - 1
        response[idx] = (0, search)(response[idx], this.opts.shellPrompt) >= 0
          ? response[idx].replace(this.opts.shellPrompt, '')
          : ''
      }
      this.response = response
      chunk = Buffer.from('')
      this.emit('responseready')
    }
    return chunk
  }

  login (handle) {
    if ((handle === 'username' || handle === 'password') && this.socket.writable) {
      this.socket.write(this.opts[handle] + this.opts.ors, () => {
        this.state = 'getprompt'
      })
    }
  }

  negotiate (chunk) {
    /* info: http://tools.ietf.org/html/rfc1143#section-7
         * Refuse to start performing and ack the start of performance
         * DO -> WONT WILL -> DO */
    const packetLength = chunk.length
    let negData = chunk
    let cmdData = Buffer.from('')
    for (let i = 0; i < packetLength; i += 3) {
      if (chunk[i] !== 255) {
        negData = chunk.slice(0, i)
        cmdData = chunk.slice(i)
        break
      }
    }
    const chunkHex = chunk.toString('hex')
    const defaultResponse = negData.toString('hex').replace(/fd/g, 'fc').replace(/fb/g, 'fd')
    let negResp = ''
    if (this.opts.terminalHeight && this.opts.terminalWidth) {
      for (let i = 0; i < chunkHex.length; i += 6) {
        let w, h
        switch (chunkHex.substr(i + 2, 4)) {
          case 'fd18':
            negResp += 'fffb18'
            break
          case 'fd1f':
            w = this.opts.terminalWidth.toString(16).padStart(4, '0')
            h = this.opts.terminalHeight.toString(16).padStart(4, '0')
            negResp += `fffb1ffffa1f${w}${h}fff0`
            break
          default:
            negResp += defaultResponse.substr(i, 6)
        }
      }
    } else { negResp = defaultResponse }
    if (this.socket.writable) {
      this.socket.write(Buffer.from(negResp, 'hex'))
    }
    return cmdData
  }

  static checkSocket (sock) {
    return sock !== null &&
            typeof sock === 'object' &&
            typeof sock.pipe === 'function' &&
            sock.writable !== false &&
            typeof sock._write === 'function' &&
            typeof sock._writableState === 'object' &&
            sock.readable !== false &&
            typeof sock._read === 'function' &&
            typeof sock._readableState === 'object'
  }

  decode (chunk) {
    if (chunk instanceof Buffer) { chunk = chunk.toString(this.opts.encoding) }
    if (this.opts.escapeHandler) {
      chunk && chunk.replace(/x1B((\[.*?[a-z])|.)/i, seq => {
        const response = this.opts.escapeHandler(seq)
        if (response) {
          this.socket.write(response)
        }
        return seq
      })
    }
    if (this.opts.stripControls) {
      chunk = chunk?.replace(/x1B((\[.*?[a-z])|.)/i, '') // Escape sequences
      chunk = chunk?.replace(/[x00-x08x0Bx0Cx0E-x1F]/g, '') // All controls except tab, lf, and cr.
    }
    if (this.opts.newlineReplace) { chunk = chunk?.replace(/\r\r\n|\r\n?/g, this.opts.newlineReplace) }
    return chunk
  }
}
exports.Telnet = Telnet
