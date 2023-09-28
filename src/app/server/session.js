/**
 * terminal/sftp/serial class
 */
const pty = require('node-pty')
const { Client } = require('@electerm/ssh2')
const proxySock = require('./socks')
const _ = require('lodash')
const generate = require('../common/uid')
const { resolve: pathResolve } = require('path')
const net = require('net')
const { exec } = require('child_process')
const log = require('../common/log')
const alg = require('./ssh2-alg')
const { readRemoteFile, writeRemoteFile } = require('./sftp-file')
const {
  session
} = require('./remote-common')
const { createLogFileName } = require('../common/create-session-log-file-path')
const SessionLog = require('./session-log')
const sshTunnelFuncs = require('./ssh-tunnel')
const {
  isWin
} = require('../common/runtime-constants')
const deepCopy = require('json-deep-copy')

function customEnv (envs) {
  if (!envs) {
    return {}
  }
  return envs.split(' ').reduce((p, k) => {
    const [key, value] = k.split('=')
    if (key && value) {
      p[key] = value
    }
    return p
  }, {})
}

// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

class Terminal {
  constructor (initOptions, ws, isTest) {
    this.type = initOptions.termType || initOptions.type
    this.pid = initOptions.uid || generate()
    this.initOptions = initOptions
    if (initOptions.saveTerminalLogToFile) {
      this.sessionLogger = new SessionLog({
        fileName: createLogFileName(initOptions.logName)
      })
    }
    this.ws = ws
    this.isTest = isTest
  }

  getDisplay () {
    return new Promise((resolve) => {
      exec('echo $DISPLAY', this.getExecOpts(), (err, out, e) => {
        if (err || e) {
          resolve('')
        } else {
          resolve((out || '').trim())
        }
      })
    })
  }

  getX11Cookie () {
    return new Promise((resolve) => {
      exec('xauth list :0', this.getExecOpts(), (err, out, e) => {
        if (err || e) {
          resolve('')
        } else {
          const s = out || ''
          const reg = /MIT-MAGIC-COOKIE-1 +([\d\w]{1,38})/
          const arr = s.match(reg)
          resolve(
            arr ? arr[1] || '' : ''
          )
        }
      })
    })
  }

  init () {
    return this[this.type + 'Init'](this.initOptions)
  }

  async serialInit () {
    const { SerialPort } = require('serialport')
    // https://serialport.io/docs/api-stream
    const {
      autoOpen = true,
      baudRate = 9600,
      dataBits = 8,
      lock = true,
      stopBits = 1,
      parity = 'none',
      rtscts = false,
      xon = false,
      xoff = false,
      xany = false,
      path
    } = this.initOptions
    await new Promise((resolve, reject) => {
      this.port = new SerialPort({
        // binding: MockBinding,
        path,
        autoOpen,
        baudRate,
        dataBits,
        lock,
        stopBits,
        parity,
        rtscts,
        xon,
        xoff,
        xany
      }, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve('ok')
        }
      })
    })
    global.sessions[this.initOptions.sessionId] = {
      id: this.initOptions.sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    }
  }

  async telnetInit () {
    const { Telnet } = require('telnet-client')
    const connection = new Telnet()
    const { initOptions } = this
    const params = _.pick(
      initOptions,
      [
        'host',
        'port',
        'timeout',
        'username',
        'password',
        'terminalWidth',
        'terminalHeight'
      ]
    )
    Object.assign(
      params,
      {
        negotiationMandatory: false,
        terminalWidth: initOptions.cols,
        terminalHeight: initOptions.rows,
        timeout: initOptions.readyTimeout,
        sendTimeout: initOptions.readyTimeout
      }
    )
    await connection.connect(params)
    await connection.shell()
    this.channel = connection
    global.sessions[this.initOptions.sessionId] = {
      id: this.initOptions.sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    }
  }

  localInit (initOptions) {
    const {
      cols,
      rows,
      execWindows,
      execMac,
      execLinux,
      execWindowsArgs,
      execMacArgs,
      execLinuxArgs,
      termType,
      term
    } = initOptions
    const { platform } = process
    const exec = platform.startsWith('win')
      ? pathResolve(
        process.env.windir,
        execWindows
      )
      : platform === 'darwin' ? execMac : execLinux
    const arg = platform.startsWith('win')
      ? execWindowsArgs
      : platform === 'darwin' ? execMacArgs : execLinuxArgs
    const cwd = process.env[platform === 'win32' ? 'USERPROFILE' : 'HOME']
    const argv = platform.startsWith('darwin') ? ['--login', ...arg] : arg
    this.term = pty.spawn(exec, argv, {
      name: term,
      encoding: null,
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env
    })
    this.term.termType = termType
    const { sessionId } = this.initOptions
    global.sessions[sessionId] = {
      id: sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    }
    return Promise.resolve('ok')
  }

  remoteInit () {
    const {
      isTest,
      initOptions
    } = this
    const { sessionId } = initOptions
    if (isTest || !sessionId || !global.sessions[sessionId]) {
      return this.remoteInitProcess()
    } else {
      return this.remoteInitTerminal()
    }
  }

  getShellWindow (initOptions = this.initOptions) {
    return _.pick(initOptions, [
      'rows', 'cols', 'term'
    ])
  }

  remoteInitTerminal () {
    const {
      initOptions
    } = this
    const connInst = session(initOptions.sessionId)
    const {
      conn,
      shellOpts
    } = connInst
    if (initOptions.enableSsh === false) {
      return true
    }
    return new Promise((resolve, reject) => {
      conn.shell(
        this.getShellWindow(),
        shellOpts,
        (err, channel) => {
          if (err) {
            return reject(err)
          }
          this.channel = channel
          this.conn = conn
          connInst.terminals[this.pid] = this
          resolve(true)
        }
      )
    })
  }

  connect (initOptions) {
    return this.remoteInitSftp(initOptions)
  }

  remoteInitSftp (initOptions) {
    this.transfers = {}
    const connInst = global.sessions[initOptions.sessionId]
    const {
      conn
    } = connInst
    this.client = conn
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err)
        }
        this.sftp = sftp
        connInst.sftps[this.pid] = this
        resolve('ok')
      })
    })
  }

  getEnv (initOptions = this.initOptions) {
    return {
      LANG: initOptions.envLang || 'en_US.UTF-8',
      ...customEnv(initOptions.setEnv)
    }
  }

  onKeyboardEvent (options) {
    const id = generate()
    this.ws.s({
      id,
      action: 'session-interactive',
      ..._.pick(this.initOptions, [
        'sessionId',
        'tabId'
      ]),
      options
    })
    return new Promise((resolve, reject) => {
      this.ws.once((arg) => {
        const { results } = arg
        if (_.isEmpty(results)) {
          return reject(new Error('User cancel'))
        }
        resolve(results)
      }, id)
    })
  }

  async getPrivateKeysInJumpServer (conn) {
    const r = await this.runCmd('ls ~/.ssh', conn)
    return r.split('\n')
      .filter(d => d.endsWith('.pub'))
      .map(d => `~/.ssh/${d}`.replace('.pub', ''))
  }

  catPrivateKeyInJumpServer (conn, filePath) {
    return this.runCmd(`cat ${filePath}`, conn)
  }

  async readPrivateKeyInJumpServer (conn) {
    const { hoppingOptions } = this
    if (this.jumpSshKeys) {
      if (this.jumpSshKeys.length > 0) {
        const p = this.jumpSshKeys.shift()
        this.jumpPrivateKeyPathFrom = p
        hoppingOptions.privateKey = await this.catPrivateKeyInJumpServer(conn, p)
      } else if (this.jumpSshKeys.length === 0) {
        delete hoppingOptions.privateKey
        delete this.jumpSshKeys
        hoppingOptions.sshKeysDrain = true
      }
      return
    }
    if (hoppingOptions.sshKeysDrain || hoppingOptions.password || hoppingOptions.privateKey) {
      return null
    }
    const list = await this.getPrivateKeysInJumpServer(conn)
    if (list.length) {
      const p = list.shift()
      this.jumpPrivateKeyPathFrom = p
      hoppingOptions.privateKey = await this.catPrivateKeyInJumpServer(conn, p)
      this.jumpSshKeys = list
    }
  }

  retryJump () {
    return this.doSshConnect(
      undefined,
      this.nextConn,
      this.hoppingOptions
    )
      .then(() => {
        this.jumpHostFrom = this.initHoppingOptions.host
        this.jumpPortFrom = this.initHoppingOptions.port
        return this.nextConn
      })
      .catch(err => {
        log.error('error when do jump connect', err, this.nextHost, this.nextPort)
        if (err.message.includes('passphrase')) {
          const options = {
            name: `passphase for ${this.jumpHostFrom}/${this.jumpPrivateKeyPathFrom}`,
            instructions: [''],
            prompts: [{
              echo: false,
              prompt: 'passphase'
            }]
          }
          return this.onKeyboardEvent(options)
            .then(data => {
              if (data && data[0]) {
                this.hoppingOptions.passphrase = data[0]
                this.jumpSshKeys && this.jumpSshKeys.unshift(this.jumpPrivateKeyPathFrom)
              }
              return this.jumpConnect(true)
            })
            .catch(e => {
              log.error('errored get passphrase for', this.jumpHostFrom, this.jumpPrivateKeyPathFrom, e)
              return this.jumpConnect(true)
            })
        } else if (
          !this.jumpSshKeys &&
          !this.hoppingOptions.password &&
          !this.hoppingOptions.privateKey &&
          err.message.includes('All configured authentication methods failed')
        ) {
          const options = {
            name: `password for ${this.hoppingOptions.username}@${this.initHoppingOptions.host}`,
            instructions: [''],
            prompts: [{
              echo: false,
              prompt: 'password'
            }]
          }
          return this.onKeyboardEvent(options)
            .then(data => {
              if (data && data[0]) {
                this.hoppingOptions.password = data[0]
                return this.jumpConnect(true)
              } else if (data && data[0] === '') {
                throw err
              }
            })
            .catch(err => {
              log.error('errored get password for', err)
              throw err
            })
        } else if (
          this.jumpSshKeys
        ) {
          return this.jumpConnect(true)
        } else {
          throw err
        }
      })
  }

  async jumpConnect (reBuildSock = false) {
    if (reBuildSock) {
      this.hoppingOptions.sock.end()
      this.hoppingOptions.sock = await this.forwardOut(this.conn, this.initHoppingOptions)
    }
    await this.readPrivateKeyInJumpServer(this.conn)
    return this.retryJump()
  }

  forwardOut (conn, hopping) {
    return new Promise((resolve, reject) => {
      conn.forwardOut('127.0.0.1', 0, hopping.host, hopping.port, async (err, stream) => {
        if (err) {
          log.error(`forwardOut to ${hopping.host}:${hopping.port} error: ` + err)
          this.endConns()
          return reject(err)
        }
        resolve(stream)
      })
    })
  }

  async jump (init) {
    const sock = await this.forwardOut(this.conn, this.initHoppingOptions)
    const hopping = deepCopy(this.initHoppingOptions)
    delete hopping.host
    delete hopping.port
    this.nextHost = hopping.host
    this.nextPort = hopping.port
    this.hoppingOptions = {
      sock,
      ...hopping
    }
    this.nextConn = new Client()
    await this.jumpConnect()
    return this.nextConn
  }

  async hopping (connectionHoppings) {
    this.conns = []
    this.jumpHostFrom = this.initOptions.host
    this.jumpPortFrom = this.initOptions.port
    for (const hopping of connectionHoppings) {
      this.conns.push(this.conn)
      this.initHoppingOptions = {
        ...hopping,
        ...this.getShareOptions()
      }
      const conn = await this.jump(true)
      if (conn) {
        this.conn = conn
      }
    }
  }

  endConns () {
    this.conn && this.conn.end && this.conn.end()
    while (this.conns && this.conns.length) {
      const conn = this.conns.shift()
      conn && conn.end()
    }
  }

  async onInitSshReady () {
    const {
      initOptions,
      isTest,
      shellOpts,
      shellWindow
    } = this
    if (
      initOptions.connectionHoppings?.length
    ) {
      await this.hopping(initOptions.connectionHoppings)
    }
    if (isTest) {
      this.endConns()
    } else if (initOptions.enableSsh === false) {
      global.sessions[initOptions.sessionId] = {
        conn: this.conn,
        id: initOptions.sessionId,
        shellOpts,
        sftps: {},
        terminals: {}
      }
    }
    const { sshTunnels = [] } = initOptions
    for (const sshTunnel of sshTunnels) {
      if (
        sshTunnel &&
        sshTunnel.sshTunnel &&
        sshTunnel.sshTunnelLocalPort &&
        sshTunnel.sshTunnelRemotePort
      ) {
        sshTunnelFuncs[sshTunnel.sshTunnel]({
          ...sshTunnel,
          conn: this.conn
        })
      }
    }
    const channel = await this.shell(this.conn, shellOpts, shellWindow)
    this.channel = channel
    global.sessions[initOptions.sessionId] = {
      conn: this.conn,
      id: initOptions.sessionId,
      shellOpts,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    }
  }

  shell (conn, shellWindow, shellOpts) {
    return new Promise((resolve, reject) => {
      conn.shell(
        shellWindow,
        shellOpts,
        (err, channel) => {
          if (err) {
            return reject(err)
          }
          resolve(channel)
        }
      )
    })
  }

  getPrivateKey (connectOptions) {
    if (this.sshKeys) {
      if (this.sshKeys.length > 0) {
        const p = this.sshKeys.shift()
        this.privateKeyPath = p
        connectOptions.privateKey = require('fs').readFileSync(p, 'utf8')
      } else if (this.sshKeys.length === 0) {
        this.connectOptions.passphrase = this.initOptions.passphrase
        delete this.connectOptions.privateKey
        delete this.sshKeys
      }
      return
    }
    const { sshKeysPath } = process.env
    const list = require('fs')
      .readdirSync(sshKeysPath)
      .filter(file => file.endsWith('.pub'))
      .map(file => pathResolve(sshKeysPath, file.replace('.pub', '')))
    if (list.length) {
      const p = list.shift()
      this.privateKeyPath = p
      connectOptions.privateKey = require('fs').readFileSync(p, 'utf8')
    }
    this.sshKeys = list
  }

  doSshConnect = (
    info,
    conn = this.conn,
    connectOptions = this.connectOptions
  ) => {
    const {
      initOptions
    } = this
    if (info && info.socket) {
      delete connectOptions.host
      delete connectOptions.port
      connectOptions.sock = info.socket
    }
    return new Promise((resolve, reject) => {
      conn.on('keyboard-interactive', async (
        name,
        instructions,
        instructionsLang,
        prompts,
        finish
      ) => {
        if (initOptions.ignoreKeyboardInteractive) {
          return finish(
            (prompts || []).map((n, i) => {
              return i ? '' : (connectOptions.password || '')
            })
          )
        }
        const options = {
          name,
          instructions,
          instructionsLang,
          prompts
        }
        this.onKeyboardEvent(options)
          .then(finish)
          .catch(reject)
      })
        .on('x11', function (info, accept) {
          let start = 0
          const maxRetry = 100
          const portStart = 6000
          const maxPort = portStart + maxRetry
          function retry () {
            if (start >= maxPort) {
              return
            }
            const xserversock = new net.Socket()
            let xclientsock
            xserversock
              .on('connect', function () {
                xclientsock = accept()
                xclientsock.pipe(xserversock).pipe(xclientsock)
              })
              .on('error', (e) => {
                log.error(e)
                xserversock.destroy()
                start = start === maxRetry ? portStart : start + 1
                retry()
              })
              .on('close', () => {
                xserversock.destroy()
                xclientsock && xclientsock.destroy()
              })
            if (start < portStart) {
              const addr = this.display?.includes('/tmp')
                ? this.display
                : `/tmp/.X11-unix/X${start}`
              xserversock.connect(addr)
            } else {
              xserversock.connect(start, '127.0.0.1')
            }
          }
          retry()
        })
        .on('ready', () => resolve(true))
        .on('error', err => {
          reject(err)
        })
        .connect(connectOptions)
    })
  }

  getShareOptions () {
    const { initOptions } = this
    return {
      tryKeyboard: true,
      readyTimeout: initOptions.readyTimeout,
      keepaliveCountMax: initOptions.keepaliveCountMax,
      keepaliveInterval: initOptions.keepaliveInterval,
      algorithms: alg
    }
  }

  buildConnectOptions () {
    const { initOptions } = this
    const connectOptions = Object.assign(
      this.getShareOptions(),
      {
        agent: process.env.SSH_AUTH_SOCK
      },
      _.pick(initOptions, [
        'host',
        'port',
        'username',
        'password',
        'privateKey',
        'passphrase'
      ])
    )
    if (initOptions.debug) {
      connectOptions.debug = log.log
    }
    if (!connectOptions.password) {
      delete connectOptions.password
    }
    if (!connectOptions.passphrase) {
      delete connectOptions.passphrase
    }
    return connectOptions
  }

  buildShellOpts () {
    const { initOptions } = this
    let x11
    if (initOptions.x11 === true) {
      x11 = {
        cookie: this.x11Cookie
      }
    }
    const shellOpts = {
      x11
    }
    shellOpts.env = this.getEnv(initOptions)
    return shellOpts
  }

  async sshConnect () {
    const { initOptions } = this
    this.conn = new Client()
    this.connectOptions = this.connectOptions || this.buildConnectOptions()
    const {
      connectOptions
    } = this
    if (
      this.sshKeys ||
      (!connectOptions.privateKey && !connectOptions.password)
    ) {
      this.getPrivateKey(this.connectOptions)
    }
    this.shellWindow = this.shellWindow || this.getShellWindow()
    this.shellOpts = this.shellOpts || this.buildShellOpts()
    const info = initOptions.proxy
      ? await proxySock({
        readyTimeout: initOptions.readyTimeout,
        host: initOptions.host,
        port: initOptions.port,
        proxy: initOptions.proxy
      })
      : undefined
    await this.doSshConnect(info).catch(err => {
      log.error('error when do sshConnect', err, this.privateKeyPath)
      if (err.message.includes('passphrase')) {
        const options = {
          name: `passphase for ${this.privateKeyPath || 'privateKey'}`,
          instructions: [''],
          prompts: [{
            echo: false,
            prompt: 'passphase'
          }]
        }
        return this.onKeyboardEvent(options)
          .then(data => {
            const pass = data ? data[0] : ''
            if (pass) {
              this.connectOptions.passphrase = data[0]
              this.sshKeys && this.sshKeys.unshift(this.privateKeyPath)
            }
            return this.nextTry(err, !!pass)
          })
          .catch(e => {
            log.error('errored get passphrase for', this.privateKeyPath, e)
            return this.nextTry(err)
          })
      } else if (
        !this.sshKeys &&
        !this.connectOptions.password &&
        !this.connectOptions.privateKey &&
        err.message.includes('All configured authentication methods failed')
      ) {
        const options = {
          name: `password for ${this.connectOptions.username}@${this.connectOptions.host}`,
          instructions: [''],
          prompts: [{
            echo: false,
            prompt: 'password'
          }]
        }
        return this.onKeyboardEvent(options)
          .then(data => {
            if (data && data[0]) {
              this.connectOptions.password = data[0]
              return this.sshConnect()
            } else if (data && data[0] === '') {
              throw err
            }
          })
          .catch(err => {
            log.error('errored get password for', err)
            throw err
          })
      }
      return this.nextTry(err)
    })
    await this.onInitSshReady()
  }

  nextTry (err, forceRetry = false) {
    if (
      this.sshKeys || forceRetry
    ) {
      log.log('retry with next ssh key')
      if (this.conn) {
        this.conn.end()
      }
      return this.sshConnect()
    } else {
      throw err
    }
  }

  async remoteInitProcess () {
    const {
      initOptions
    } = this
    const hasX11 = initOptions.x11 === true
    this.display = hasX11 ? await this.getDisplay() : undefined
    this.x11Cookie = hasX11 ? await this.getX11Cookie() : undefined
    return this.sshConnect()
  }

  resize (cols, rows) {
    this[this.type + 'Resize'](cols, rows)
  }

  telnetResize (cols, rows) {
    this.channel.opts.terminalWidth = cols
    this.channel.opts.terminalHeight = rows
  }

  serialResize () {

  }

  localResize (cols, rows) {
    this.term.resize(cols, rows)
  }

  remoteResize (cols, rows) {
    this.channel.setWindow(rows, cols)
  }

  on (event, cb) {
    this[this.type + 'On'](event, cb)
  }

  serialOn (event, cb) {
    this.port.on(event, cb)
  }

  telnetOn (event, cb) {
    this.channel.on(event, cb)
  }

  localOn (event, cb) {
    this.term.on(event, cb)
  }

  remoteOn (event, cb) {
    this.channel.on(event, cb)
    this.channel.stderr.on(event, cb)
  }

  write (data) {
    try {
      (this.term || this.channel || this.port).write(data)
      if (this.sshLogger) {
        this.sshLogger.write(data)
      }
    } catch (e) {
      log.error(e)
    }
  }

  kill () {
    this[`${this.type}Kill`]()
    if (this.sshLogger) {
      this.sshLogger.destroy()
    }
  }

  serialKill () {
    this.port && this.port.isOpen && this.port.close()
    delete this.port
  }

  telnetKill () {
    this.channel && this.channel.destroy()
    delete this.channel
  }

  localKill () {
    if (!isWin) {
      this.term && this.term.kill()
    }
    this.onEndConn()
  }

  remoteKill () {
    this.channel && this.channel.end()
    delete this.channel
    this.onEndConn()
  }

  sftpKill () {
    const keys = Object.keys(this.transfers || {})
    for (const k of keys) {
      const jj = this.transfers[k]
      jj && jj.destroy && jj.destroy()
      delete this.transfers[k]
    }
    this.sftp && this.sftp.end()
    delete this.sftp
    this.onEndConn()
  }

  onEndConn () {
    const inst = global.sessions[
      this.initOptions.sessionId
    ]
    if (!inst) {
      return
    }
    delete inst.sftps[this.pid]
    delete inst.terminals[this.pid]
    if (this.server && this.server.end) {
      this.server.end()
    }
    if (
      _.isEmpty(inst.sftps) &&
      _.isEmpty(inst.terminals)
    ) {
      this.endConns()
      delete global.sessions[
        this.initOptions.sessionId
      ]
    }
  }

  /**
   * list remote directory
   *
   * @param {String} remotePath
   * @return {Promise} list
   */
  list (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      const reg = /-/g

      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          return reject(err)
        }
        resolve(list.map(item => {
          const {
            filename,
            longname,
            attrs: {
              size, mtime, atime, uid, gid, mode
            }
          } = item
          // from https://github.com/jyu213/ssh2-sftp-client/blob/master/src/index.js
          return {
            type: longname.substr(0, 1),
            name: filename,
            size,
            modifyTime: mtime * 1000,
            accessTime: atime * 1000,
            mode,
            rights: {
              user: longname.substr(1, 3).replace(reg, ''),
              group: longname.substr(4, 3).replace(reg, ''),
              other: longname.substr(7, 3).replace(reg, '')
            },
            owner: uid,
            group: gid
          }
        }))
      })
    })
  }

  /**
   * mkdir
   *
   * @param {String} remotePath
   * @param {Object} attributes
   * An object with the following valid properties:

      mode - integer - Mode/permissions for the resource.
      uid - integer - User ID of the resource.
      gid - integer - Group ID of the resource.
      size - integer - Resource size in bytes.
      atime - integer - UNIX timestamp of the access time of the resource.
      mtime - integer - UNIX timestamp of the modified time of the resource.

      When supplying an ATTRS object to one of the SFTP methods:
      atime and mtime can be either a Date instance or a UNIX timestamp.
      mode can either be an integer or a string containing an octal number.
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  mkdir (remotePath, options = {}) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.mkdir(remotePath, options, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * getHomeDir
   *
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * only support linux / mac
   * @return {Promise}
   */
  getHomeDir () {
    return this.runCmd('eval echo "~$different_user"')
  }

  getExecOpts () {
    return {
      env: this.getEnv()
    }
  }

  runCmd (cmd, conn) {
    return new Promise((resolve, reject) => {
      const client = conn || this.conn || this.client
      client.exec(cmd, this.getExecOpts(), (err, stream) => {
        if (err) reject(err)
        if (stream) {
          let r = ''
          stream
            .on('data', function (data) {
              const d = data.toString()
              r = r + d
            })
            .on('close', (code, signal) => {
              resolve(r)
            })
        } else {
          resolve('')
        }
      })
    })
  }

  /**
   * rmdir
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * only support rm -rf
   * @return {Promise}
   */
  rmdir (remotePath) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `rm -rf "${remotePath}"`
      client.exec(cmd, this.getExecOpts(), err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * stat
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} stat
   *  stats.isDirectory()
      stats.isFile()
      stats.isBlockDevice()
      stats.isCharacterDevice()
      stats.isSymbolicLink()
      stats.isFIFO()
      stats.isSocket()
   */
  stat (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.stat(remotePath, (err, stat) => {
        if (err) reject(err)
        else {
          resolve(
            Object.assign(stat, {
              isDirectory: stat.isDirectory()
            })
          )
        }
      })
    })
  }

  /**
   * readlink
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} target
   */
  readlink (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.readlink(remotePath, (err, target) => {
        if (err) reject(err)
        else resolve(target)
      })
    })
  }

  /**
   * realpath
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} target
   */
  realpath (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.realpath(remotePath, (err, target) => {
        if (err) reject(err)
        else resolve(target)
      })
    })
  }

  /**
   * lstat
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} stat
   *  stats.isDirectory()
      stats.isFile()
      stats.isBlockDevice()
      stats.isCharacterDevice()
      stats.isSymbolicLink()
      stats.isFIFO()
      stats.isSocket()
   */
  lstat (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.lstat(remotePath, (err, stat) => {
        if (err) reject(err)
        else resolve(stat)
      })
    })
  }

  /**
   * chmod
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  chmod (remotePath, mode) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.chmod(remotePath, mode, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * rename
   *
   * @param {String} remotePath
   * @param {String} remotePathNew
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  rename (remotePath, remotePathNew) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.rename(remotePath, remotePathNew, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * rm delete single file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  rm (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.unlink(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * touch a file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  touch (remotePath) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `touch "${remotePath}"`
      client.exec(cmd, this.getExecOpts(), err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * mv
   *
   * @param {String} from
   * @param {String} to
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  mv (from, to) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `mv "${from}" "${to}"`
      client.exec(cmd, this.getExecOpts(), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * cp
   *
   * @param {String} from
   * @param {String} to
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  cp (from, to) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `cp -r "${from}" "${to}"`
      client.exec(cmd, this.getExecOpts(), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * readFile single file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  readFile (remotePath) {
    return readRemoteFile(this.sftp, remotePath)
  }

  /**
   * writeFile single file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  writeFile (remotePath, str, mode) {
    return writeRemoteFile(this.sftp, remotePath, str, mode)
  }
  // end
}

exports.terminal = async function (initOptions, ws) {
  const term = new Terminal(initOptions, ws)
  await term.init()
  return term
}

exports.Terminal = Terminal

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnection = (options) => {
  return (new Terminal(options, undefined, true))
    .remoteInit()
    .catch(() => {
      return false
    })
}
