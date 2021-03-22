/**
 * terminal/sftp/serial class
 */
const pty = require('node-pty')
const { Client } = require('ssh2')
const proxySock = require('./socks')
const _ = require('lodash')
const generate = require('../common/uid')
const { resolve } = require('path')
const net = require('net')
const { exec } = require('child_process')
const log = require('../utils/log')
const alg = require('./ssh2-alg')
const { readRemoteFile, writeRemoteFile } = require('./sftp-file')
const {
  session
} = require('./remote-common')
const { createLogFileName } = require('../common/create-session-log-file-path')
const SessionLog = require('./session-log')
// const MockBinding = require('@serialport/binding-mock')

// SerialPort.Binding = MockBinding
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

function getDisplay () {
  return new Promise((resolve) => {
    exec('echo $DISPLAY', (err, out, e) => {
      if (err || e) {
        resolve('')
      } else {
        resolve((out || '').trim())
      }
    })
  })
}

function getX11Cookie () {
  return new Promise((resolve) => {
    exec('xauth list :0', (err, out, e) => {
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

class Terminal {
  constructor (initOptions, ws) {
    this.type = initOptions.termType || initOptions.type
    this.pid = initOptions.uid || generate()
    this.initOptions = initOptions
    if (initOptions.saveTerminalLogToFile) {
      this.sessionLogger = new SessionLog({
        fileName: createLogFileName(initOptions.tabId)
      })
    }
    if (ws) {
      this.ws = ws
    }
  }

  init () {
    return this[this.type + 'Init'](this.initOptions)
  }

  // async serialInit () {
  //   const SerialPort = require('serialport')
  //   // https://serialport.io/docs/api-stream
  //   const {
  //     autoOpen = true,
  //     baudRate = 9600,
  //     dataBits = 8,
  //     lock = true,
  //     stopBits = 1,
  //     parity = 'none',
  //     rtscts = false,
  //     xon = false,
  //     xoff = false,
  //     xany = false,
  //     path
  //   } = this.initOptions
  //   await new Promise((resolve, reject) => {
  //     this.port = new SerialPort(path, {
  //       autoOpen,
  //       baudRate,
  //       dataBits,
  //       lock,
  //       stopBits,
  //       parity,
  //       rtscts,
  //       xon,
  //       xoff,
  //       xany
  //     }, (err) => {
  //       if (err) {
  //         reject(err)
  //       } else {
  //         resolve('ok')
  //       }
  //     })
  //   })
  //   global.sessions[this.initOptions.sessionId] = {
  //     id: this.initOptions.sessionId,
  //     sftps: {},
  //     terminals: {
  //       [this.pid]: this
  //     }
  //   }
  // }

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
      ? resolve(
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

  remoteInit (initOptions, isTest) {
    const { sessionId } = initOptions
    if (isTest || !sessionId || !global.sessions[sessionId]) {
      return this.remoteInitProcess(initOptions, isTest)
    } else {
      return this.remoteInitTerminal(initOptions)
    }
  }

  getShellWindow (initOptions = this.initOptions) {
    return _.pick(initOptions, [
      'rows', 'cols', 'term'
    ])
  }

  remoteInitTerminal (initOptions) {
    const connInst = session(initOptions.sessionId)
    const {
      conn,
      shellOpts
    } = connInst
    return new Promise((resolve, reject) => {
      conn.shell(
        this.getShellWindow(),
        shellOpts,
        (err, channel) => {
          if (err) {
            return reject(err)
          }
          this.channel = channel
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
    this.initOptions = initOptions
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

  async remoteInitProcess (initOptions, isTest) {
    const display = await getDisplay()
    const x11Cookie = await getX11Cookie()

    return new Promise((resolve, reject) => {
      const conn = new Client()
      this.conn = conn
      const opts = Object.assign(
        {
          tryKeyboard: true
        },
        {
          readyTimeout: _.get(initOptions, 'readyTimeout'),
          keepaliveCountMax: _.get(initOptions, 'keepaliveCountMax'),
          keepaliveInterval: _.get(initOptions, 'keepaliveInterval'),
          agent: process.env.SSH_AUTH_SOCK,
          algorithms: alg
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
        opts.debug = log.log
      }
      if (!opts.password) {
        delete opts.password
      }
      if (!opts.passphrase) {
        delete opts.passphrase
      }
      let x11
      if (initOptions.x11 === true) {
        x11 = {
          cookie: x11Cookie
        }
      }
      const shellOpts = {
        x11
      }
      shellOpts.env = {
        LANG: initOptions.envLang || 'en_US.UTF-8'
      }
      const shellWindow = this.getShellWindow()
      const run = (info) => {
        if (info && info.socket) {
          delete opts.host
          delete opts.port
          opts.sock = info.socket
        }
        conn
          .on('keyboard-interactive', async (
            name,
            instructions,
            instructionsLang,
            prompts,
            finish
          ) => {
            if (initOptions.ignoreKeyboardInteractive) {
              return finish(
                (prompts || []).map((n, i) => {
                  return i ? '' : (opts.password || '')
                })
              )
            }
            const options = {
              name,
              instructions,
              instructionsLang,
              prompts
            }
            const result = await this.onKeyboardEvent(options)
              .catch(reject)
            finish(result)
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
                const addr = display.includes('/tmp')
                  ? display
                  : `/tmp/.X11-unix/X${start}`
                xserversock.connect(addr)
              } else {
                xserversock.connect(start, '127.0.0.1')
              }
            }
            retry()
          })
          .on('ready', () => {
            if (isTest) {
              conn.end()
              return resolve(true)
            }
            conn.shell(
              shellWindow,
              shellOpts,
              (err, channel) => {
                if (err) {
                  return reject(err)
                }
                this.channel = channel
                global.sessions[initOptions.sessionId] = {
                  conn,
                  id: initOptions.sessionId,
                  shellOpts,
                  sftps: {},
                  terminals: {
                    [this.pid]: this
                  }
                }
                resolve(true)
              }
            )
          })
          .on('error', err => {
            log.error('errored terminal', err)
            conn.end()
            reject(err)
          })
          .connect(opts)
      }
      if (
        initOptions.proxy &&
        initOptions.proxy.proxyIp &&
        initOptions.proxy.proxyPort
      ) {
        proxySock({
          ...initOptions,
          ...opts
        })
          .then(run)
          .catch(reject)
      } else {
        run()
      }
    })
  }

  resize (cols, rows) {
    this[this.type + 'Resize'](cols, rows)
  }

  // serialResize () {

  // }

  localResize (cols, rows) {
    this.term.resize(cols, rows)
  }

  remoteResize (cols, rows) {
    this.channel.setWindow(rows, cols)
  }

  on (event, cb) {
    this[this.type + 'On'](event, cb)
  }

  // serialOn (event, cb) {
  //   this.port.on(event, cb)
  // }

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

  // serialKill () {
  //   this.port && this.port.isOpen && this.port.close()
  //   delete this.port
  // }

  localKill () {
    this.term && this.term.kill()
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
    if (
      _.isEmpty(inst.sftps) &&
      _.isEmpty(inst.terminals)
    ) {
      inst.conn && inst.conn.end && inst.conn.end()
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

  runCmd (cmd) {
    return new Promise((resolve, reject) => {
      const client = this.conn || this.client
      client.exec(cmd, (err, stream) => {
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
      client.exec(cmd, err => {
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
      client.exec(cmd, err => {
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
      client.exec(cmd, (err) => {
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
      client.exec(cmd, (err) => {
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
  return (new Terminal(options))
    .remoteInit(options, true)
    .catch(() => {
      return false
    })
}
