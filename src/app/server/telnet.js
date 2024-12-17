// used code from https://github.com/Eugeny/tabby/blob/master/tabby-telnet/src/session.ts and from https://github.com/mkozjak/node-telnet-client

const { EventEmitter } = require('events')
const { Socket } = require('net')
const { Duplex } = require('stream')

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

class Stream extends Duplex {
  constructor (socket, options) {
    super(options)
    this.socket = socket
    this.socket.on('data', data => this.push(data))
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
      loginPrompt: /login[: ]*$/i,
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
  }

  connect (options = {}) {
    return new Promise((resolve, reject) => {
      Object.assign(this.options, options)

      if (this.options.sock) {
        this.socket = this.options.sock
      } else {
        this.socket = new Socket()
      }

      this.socket.setTimeout(this.options.timeout || 0)

      this.socket.on('connect', () => {
        this.state = 'connected'
        this.emit('connect')
        if (!this.options.negotiationMandatory) {
          resolve()
        }
      })

      this.socket.on('timeout', () => {
        this.emit('timeout')
        reject(new Error('Connection timeout'))
      })

      this.socket.on('error', (error) => {
        this.emit('error', error)
        reject(error)
      })

      this.socket.on('end', () => {
        this.emit('end')
      })

      this.socket.on('close', () => {
        this.emit('close')
      })

      this.socket.on('data', (data) => {
        const processedData = this.processData(data)
        if (processedData && processedData.length > 0) {
          this.handleLoginSequence(processedData)
        }
      })

      if (!this.options.sock) {
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

  handleLoginSequence (data) {
    if (this.authenticated) {
      this.emit('data', data)
      return
    }

    const str = data.toString()
    this.dataBuffer += str

    // Check for failed login
    if (this.options.failedLoginMatch.test(this.dataBuffer)) {
      this.emit('failedlogin')
      this.dataBuffer = ''
      return
    }

    // Check for login prompt
    if (!this.loginAttempted &&
        this.options.username &&
        this.options.loginPrompt.test(this.dataBuffer)) {
      setTimeout(() => {
        this.socket.write(this.options.username + '\n')
      }, 100)
      this.loginAttempted = true
      this.dataBuffer = ''
      return
    }

    // Check for password prompt
    if (!this.passwordAttempted &&
        this.options.password &&
        this.options.passwordPrompt.test(this.dataBuffer)) {
      setTimeout(() => {
        this.socket.write(this.options.password + '\n')
      }, 100)
      this.passwordAttempted = true
      this.dataBuffer = ''
      return
    }

    // If both login and password were attempted, consider it authenticated
    if (this.loginAttempted && this.passwordAttempted) {
      this.authenticated = true
      this.emit('data', data)
    }

    // Keep only last chunk in buffer for prompt detection
    if (this.dataBuffer.length > 1024) {
      this.dataBuffer = this.dataBuffer.slice(-1024)
    }
  }

  processData (data) {
    if (!this.telnetProtocol && data[0] === TelnetCommands.IAC) {
      this.telnetProtocol = true
      this.emit('telnetProtocol')
    }

    if (this.telnetProtocol) {
      data = this.processTelnetProtocol(data)
    }

    if (data && data.length > 0) {
      return data
    }
    return null
  }

  processTelnetProtocol (data) {
    let position = 0
    let resultBuffer = Buffer.alloc(0)

    while (position < data.length) {
      if (data[position] === TelnetCommands.IAC) {
        if (position + 1 >= data.length) {
          this.buffer = data.slice(position)
          return Buffer.concat([resultBuffer, data.slice(0, position)])
        }

        const command = data[position + 1]

        if (command === TelnetCommands.IAC) {
          resultBuffer = Buffer.concat([resultBuffer, Buffer.from([TelnetCommands.IAC])])
          position += 2
        } else if ([TelnetCommands.WILL, TelnetCommands.WONT, TelnetCommands.DO, TelnetCommands.DONT].includes(command)) {
          if (position + 2 >= data.length) {
            this.buffer = data.slice(position)
            return Buffer.concat([resultBuffer, data.slice(0, position)])
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
            return Buffer.concat([resultBuffer, data.slice(0, position)])
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
    this.socket.write(Buffer.from([TelnetCommands.IAC, command, option]))
  }

  emitTelnetSuboption (option, value) {
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
    return new Stream(this.socket, options)
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
