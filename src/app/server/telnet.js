// used code from https://github.com/Eugeny/tabby/blob/master/tabby-telnet/src/session.ts and from https://github.com/mkozjak/node-telnet-client

const { EventEmitter } = require('events')
const { Socket } = require('net')
const { Duplex } = require('stream')
const proxySock = require('./socks')

const TelnetCommands = {
  SUBOPTION_END: 240,
  GA: 249,
  SUBOPTION: 250,
  WILL: 251,
  WONT: 252,
  DO: 253,
  DONT: 254,
  IAC: 255
}

const TelnetOptions = {
  ECHO: 1,
  SUPPRESS_GO_AHEAD: 3,
  STATUS: 5,
  TERMINAL_TYPE: 24,
  NEGO_WINDOW_SIZE: 31,
  NEGO_TERMINAL_SPEED: 32,
  REMOTE_FLOW_CONTROL: 33,
  X_DISPLAY_LOCATION: 35,
  NEW_ENVIRON: 39
}

// Max auto-login retries after a failed attempt before we give up
// and leave the login to the user
const MAX_LOGIN_FAILURES = 3

class Stream extends Duplex {
  constructor (socket, options) {
    super(options)
    this.socket = socket
    // Raw socket data is NOT pushed here directly - Telnet parses it
    // (strips IAC negotiation sequences) and pushes the parsed bytes in
    this.socket.on('end', () => {
      if (!this.readableEnded) {
        this.push(null)
      }
    })
    this.socket.on('close', () => {
      if (!this.destroyed) {
        this.emit('close')
      }
    })
    this.socket.on('error', err => {
      this.emit('error', err)
    })
  }

  _write (data, encoding, callback) {
    if (!this.socket.writable && callback) {
      callback(new Error('socket not writable'))
      return
    }
    this.socket.write(data, encoding, callback)
  }

  _read () {}
}

class Telnet extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = {
      host: '127.0.0.1',
      port: 23,
      timeout: 5000,
      negotiationMandatory: false,
      username: '',
      password: '',
      terminalWidth: 80,
      terminalHeight: 24,
      loginPrompt: /login[: ]*$|user(name)?[: ]*$/i,
      passwordPrompt: /password[: ]*$/i,
      failedLoginMatch: /failed|incorrect|denied/i,
      ...options
    }
    this.socket = null
    this.telnetProtocol = false
    this.state = 'init'
    this.buffer = Buffer.alloc(0)
    this.dataBuffer = ''
    this.authenticated = false
    this.loginAttempted = false
    this.passwordAttempted = false
    this.loginFailedCount = 0
    this.shellStream = null
  }

  async connect (options = {}) {
    Object.assign(this.options, options)

    // No credentials configured - just pass everything through and
    // let the user type them manually
    if (!this.options.username && !this.options.password) {
      this.authenticated = true
    }

    // If proxy is specified, establish proxied connection first
    if (this.options.proxy) {
      try {
        const info = await proxySock({
          readyTimeout: this.options.timeout,
          host: this.options.host,
          port: this.options.port,
          proxy: this.options.proxy
        })
        this.options.sock = info.socket
      } catch (error) {
        this.emit('error', error)
        throw error
      }
    }

    return new Promise((resolve, reject) => {
      if (this.options.sock) {
        this.socket = this.options.sock
      } else {
        this.socket = new Socket()
      }

      this.socket.setTimeout(this.options.timeout || 0)

      const onConnected = () => {
        this.state = 'connected'
        // The timeout option is only meant for the connection phase -
        // disable the idle timeout so long-lived sessions are not killed
        this.socket.setTimeout(0)
        this.emit('connect')
        if (!this.options.negotiationMandatory) {
          resolve()
        }
      }

      this.socket.on('connect', onConnected)

      this.socket.on('timeout', () => {
        this.emit('timeout')
        reject(new Error('Connection timeout'))
      })

      this.socket.on('error', (error) => {
        this.emit('error', error)
        reject(error)
      })

      this.socket.on('end', () => {
        this.state = 'ended'
        this.emit('end')
      })

      this.socket.on('close', () => {
        this.state = 'closed'
        this.emit('close')
      })

      this.socket.on('data', (data) => {
        const processedData = this.processData(data)
        if (processedData && processedData.length > 0) {
          this.handleLoginSequence(processedData)
        }
      })

      // If sock was provided (including from proxy), emit connect event
      // Otherwise, create a new connection
      if (this.options.sock) {
        // Socket already connected via proxy
        onConnected()
      } else {
        this.socket.connect({
          host: this.options.host,
          port: this.options.port
        })
      }

      this.once('telnetProtocol', () => {
        this.emitTelnet(TelnetCommands.DO, TelnetOptions.SUPPRESS_GO_AHEAD)
        this.emitTelnet(TelnetCommands.WILL, TelnetOptions.TERMINAL_TYPE)
        this.emitTelnet(TelnetCommands.WILL, TelnetOptions.NEGO_WINDOW_SIZE)
        if (this.options.negotiationMandatory) {
          resolve()
        }
      })
    })
  }

  // Parsed (protocol-stripped) output goes to the shell stream - that is
  // what the terminal session consumes - and to the 'data' event
  emitData (data) {
    if (this.shellStream && !this.shellStream.destroyed) {
      this.shellStream.push(data)
    }
    this.emit('data', data)
  }

  handleLoginSequence (data) {
    if (this.authenticated) {
      this.emitData(data)
      return
    }

    const str = data.toString()
    this.dataBuffer += str

    // Always show server output to the user (banner, prompts, errors) -
    // auto login happens in parallel, so the user is never left with a
    // blank screen when the prompts do not match
    this.emitData(data)

    // Check for failed login - only meaningful after we tried credentials
    if ((this.loginAttempted || this.passwordAttempted) &&
        this.options.failedLoginMatch.test(this.dataBuffer)) {
      this.loginFailedCount++
      this.dataBuffer = ''
      this.emit('failedlogin')
      if (this.loginFailedCount >= MAX_LOGIN_FAILURES) {
        // Give up auto login, let the user handle it manually
        this.authenticated = true
      } else {
        this.loginAttempted = false
        this.passwordAttempted = false
      }
      return
    }

    // Check for login prompt
    if (!this.loginAttempted &&
        this.options.username &&
        this.options.loginPrompt.test(this.dataBuffer)) {
      this.socket.write(this.options.username + '\r\n')
      this.loginAttempted = true
      this.dataBuffer = ''
      return
    }

    // Check for password prompt
    if (!this.passwordAttempted &&
        this.options.password &&
        this.options.passwordPrompt.test(this.dataBuffer)) {
      this.socket.write(this.options.password + '\r\n')
      this.passwordAttempted = true
      this.dataBuffer = ''
      return
    }

    // Once all configured credentials were sent, consider it authenticated
    // Some servers do not ask for a password at all
    if (
      (this.loginAttempted && (this.passwordAttempted || !this.options.password)) ||
      (!this.options.username && this.passwordAttempted)
    ) {
      this.authenticated = true
    }

    // Keep only last chunk(s) in buffer for prompt detection
    if (this.dataBuffer.length > 2048) {
      this.dataBuffer = this.dataBuffer.slice(-1024)
    }
  }

  processData (data) {
    // A previous chunk may have ended in the middle of an IAC sequence -
    // those pending bytes must be processed together with the new data
    if (this.buffer && this.buffer.length) {
      data = Buffer.concat([this.buffer, data])
      this.buffer = Buffer.alloc(0)
    }

    if (!this.telnetProtocol) {
      // Hold back a trailing lone IAC byte - it may be the first byte of
      // a negotiation sequence split across chunks, and without protocol
      // mode enabled it would leak to the terminal as garbage
      if (data[data.length - 1] === TelnetCommands.IAC) {
        this.buffer = data.slice(-1)
        data = data.slice(0, -1)
      }
      this.detectTelnetProtocol(data)
      if (!this.telnetProtocol) {
        return data.length > 0 ? data : null
      }
    }

    data = this.processTelnetProtocol(data)

    if (data && data.length > 0) {
      return data
    }
    return null
  }

  detectTelnetProtocol (data) {
    // Some servers start negotiation right away (IAC as the first byte),
    // others send a banner first and negotiate later - scan the whole chunk
    // for an IAC byte followed by a valid telnet command byte (239-255)
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i] === TelnetCommands.IAC && data[i + 1] >= 239) {
        this.telnetProtocol = true
        this.emit('telnetProtocol')
        return
      }
    }
  }

  processTelnetProtocol (data) {
    let position = 0
    let resultBuffer = Buffer.alloc(0)

    while (position < data.length) {
      if (data[position] === TelnetCommands.IAC) {
        if (position + 1 >= data.length) {
          // Incomplete sequence at chunk end - hold it for the next chunk.
          // resultBuffer already holds all plain data before it, consumed
          // command bytes must NOT be re-emitted here
          this.buffer = data.slice(position)
          return resultBuffer
        }

        const command = data[position + 1]

        if (command === TelnetCommands.IAC) {
          resultBuffer = Buffer.concat([resultBuffer, Buffer.from([TelnetCommands.IAC])])
          position += 2
        } else if ([TelnetCommands.WILL, TelnetCommands.WONT, TelnetCommands.DO, TelnetCommands.DONT].includes(command)) {
          if (position + 2 >= data.length) {
            this.buffer = data.slice(position)
            return resultBuffer
          }

          const option = data[position + 2]
          this.handleTelnetCommand(command, option)
          position += 3
        } else if (command === TelnetCommands.SUBOPTION) {
          let endPos = position + 2
          while (endPos < data.length - 1) {
            if (data[endPos] === TelnetCommands.IAC && data[endPos + 1] === TelnetCommands.SUBOPTION_END) {
              break
            }
            endPos++
          }

          if (endPos >= data.length - 1) {
            this.buffer = data.slice(position)
            return resultBuffer
          }

          this.handleSuboption(data.slice(position + 2, endPos))
          position = endPos + 2
        } else {
          position += 2
        }
      } else {
        const nextIAC = data.indexOf(TelnetCommands.IAC, position)
        if (nextIAC === -1) {
          resultBuffer = Buffer.concat([resultBuffer, data.slice(position)])
          break
        } else {
          resultBuffer = Buffer.concat([resultBuffer, data.slice(position, nextIAC)])
          position = nextIAC
        }
      }
    }

    return resultBuffer
  }

  handleTelnetCommand (command, option) {
    switch (command) {
      case TelnetCommands.WILL:
        if ([TelnetOptions.SUPPRESS_GO_AHEAD, TelnetOptions.ECHO].includes(option)) {
          this.emitTelnet(TelnetCommands.DO, option)
        } else {
          this.emitTelnet(TelnetCommands.DONT, option)
        }
        break

      case TelnetCommands.DO:
        if (option === TelnetOptions.NEGO_WINDOW_SIZE) {
          this.emitTelnet(TelnetCommands.WILL, option)
          this.sendWindowSize()
        } else if (option === TelnetOptions.TERMINAL_TYPE) {
          this.emitTelnet(TelnetCommands.WILL, option)
        } else {
          this.emitTelnet(TelnetCommands.WONT, option)
        }
        break

      case TelnetCommands.WONT:
      case TelnetCommands.DONT:
        // Do nothing
        break
    }
  }

  handleSuboption (data) {
    const option = data[0]
    if (option === TelnetOptions.TERMINAL_TYPE) {
      if (data[1] === 1) { // SEND
        this.emitTelnetSuboption(TelnetOptions.TERMINAL_TYPE,
          Buffer.from([0, ...Buffer.from('xterm')]))
      }
    }
  }

  emitTelnet (command, option) {
    if (!this.socket) {
      return
    }
    this.socket.write(Buffer.from([TelnetCommands.IAC, command, option]))
  }

  emitTelnetSuboption (option, value) {
    if (!this.socket) {
      return
    }
    this.socket.write(Buffer.from([
      TelnetCommands.IAC,
      TelnetCommands.SUBOPTION,
      option,
      ...value,
      TelnetCommands.IAC,
      TelnetCommands.SUBOPTION_END
    ]))
  }

  sendWindowSize () {
    const { terminalWidth, terminalHeight } = this.options
    this.emitTelnetSuboption(TelnetOptions.NEGO_WINDOW_SIZE, Buffer.from([
      terminalWidth >> 8, terminalWidth & 0xff,
      terminalHeight >> 8, terminalHeight & 0xff
    ]))
  }

  shell (options = {}) {
    this.shellStream = new Stream(this.socket, options)
    return this.shellStream
  }

  end () {
    if (this.socket) {
      this.socket.end()
    }
  }

  destroy () {
    if (this.socket) {
      this.socket.destroy()
    }
  }
}

exports.Telnet = Telnet
