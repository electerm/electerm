/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const { TerminalBase } = require('./session-base')
const net = require('net')
const proxySock = require('./socks')
const uid = require('../common/uid')
const { terminalSsh } = require('./session-ssh')

function getPort (fromPort = 120023) {
  return new Promise((resolve, reject) => {
    require('find-free-port')(fromPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        resolve(freePort)
      }
    })
  })
}

class TerminalVnc extends TerminalBase {
  init = async () => {
    global.sessions[this.initOptions.sessionId] = {
      id: this.initOptions.sessionId,
      terminals: {
        [this.pid]: this
      }
    }
    return Promise.resolve(this)
  }

  start = async (width, height) => {
    if (this.isRunning) {
      return
    }
    this.isRunning = true
    if (this.channel) {
      this.channel.close()
      delete this.channel
    }
    const {
      host,
      port
    } = this.initOptions
    const info = await this.hop()
    const target = net.createConnection({
      port,
      host,
      ...info
    }, this.onConnect)
    this.channel = target
    target.on('data', this.onData)
    target.on('end', this.kill)
    target.on('error', this.onError)

    this.ws.on('message', this.onMsg)
    this.ws.on('close', this.kill)
    this.width = width
    this.height = height
  }

  hop = async () => {
    const {
      host,
      port,
      proxy,
      readyTimeout,
      connectionHoppings
    } = this.initOptions
    if (!connectionHoppings || !connectionHoppings.length) {
      return proxy
        ? await proxySock({
          readyTimeout,
          host,
          port,
          proxy
        })
        : undefined
    }
    const [hop, ...rest] = connectionHoppings
    const fp = await getPort(12023)
    console.log('get free port', fp)
    const initOpts = {
      connectionHoppings: rest,
      ...hop,
      cols: 80,
      rows: 24,
      term: 'xterm-256color',
      saveTerminalLogToFile: false,
      id: uid(),
      enableSsh: true,
      encode: 'utf-8',
      envLang: 'en_US.UTF-8',
      proxy,
      sessionId: uid(),
      sshTunnels: [
        {
          sshTunnel: 'dynamicForward',
          sshTunnelLocalHost: '127.0.0.1',
          sshTunnelLocalPort: fp,
          id: uid()
        }
      ]
    }
    this.ssh = await terminalSsh(initOpts)
    const proxyA = `socks5://127.0.0.1:${fp}`
    return proxySock({
      readyTimeout,
      host,
      port,
      proxy: proxyA
    })
    /*
    this.initOptions {
      cols: 80,
      rows: 24,
      term: 'xterm-256color',
      saveTerminalLogToFile: false,
      id: '4GVMkvc',
      title: 'dynamic proxy sock5: 12200',
      host: '192.168.2.26',
      username: 'zxd',
      authType: 'password',
      password: 'zxd',
      port: 22,
      loginScriptDelay: 500,
      encode: 'utf-8',
      enableSsh: true,
      envLang: 'en_US.UTF-8',
      sshTunnels: [
        {
          sshTunnel: 'dynamicForward',
          sshTunnelLocalHost: '127.0.0.1',
          sshTunnelLocalPort: 12200,
          name: 'proxy',
          id: 'izPzwUB'
        }
      ],
      connectionHoppings: [],
      proxy: '',
      color: '#d73a49',
      runScripts: [ {} ],
      displayRaw: false,
      from: 'bookmarks',
      srcId: 'lMg7jTx',
      status: 'processing',
      pane: 'terminal',
      tabCount: 2,
      logName: 'dynamic proxy sock5꞉ 12200_192.168.2.26_c-okdK8_2024-06-06-18-59-15',
      addTimeStampToTermLog: false,
      keepaliveInterval: 10000,
      keepaliveCountMax: 10,
      execWindows: 'System32/WindowsPowerShell/v1.0/powershell.exe',
      execMac: 'zsh',
      execLinux: 'bash',
      execWindowsArgs: [],
      execMacArgs: [],
      execLinuxArgs: [],
      debug: false,
      sessionId: 'dkBMppP',
      tabId: 'c-okdK8_2024-06-06-18-59-15',
      srcTabId: '4GVMkvc',
      terminalIndex: 0,
      readyTimeout: 50000,
      type: 'remote'
    }
    */
  }

  onMsg = (msg) => {
    this.channel.write(msg)
  }

  onData = (data) => {
    try {
      this.ws?.send(data)
    } catch (e) {
      log.error('vnc connection send data error', e)
    }
  }

  resize () {

  }

  onError = (err) => {
    log.error('vnc error', err)
    this.kill()
  }

  test = async () => {
    return Promise.resolve(true)
  }

  kill = () => {
    log.debug('Closed vnc session ' + this.pid)
    if (this.ws) {
      this.ws.close()
      delete this.ws
    }
    if (this.ssh) {
      this.ssh.kill()
      delete this.ssh
    }
    this.channel && this.channel.end()
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    const inst = global.sessions[
      this.initOptions.sessionId
    ]
    if (!inst) {
      return
    }
    delete inst.terminals[this.pid]
    if (
      _.isEmpty(inst.terminals)
    ) {
      delete global.sessions[
        this.initOptions.sessionId
      ]
    }
  }
}

exports.terminalVnc = async function (initOptions, ws) {
  const term = new TerminalVnc(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnectionVnc = (options) => {
  return (new TerminalVnc(options, undefined, true))
    .test()
    .then(() => {
      return true
    })
    .catch(() => {
      return false
    })
}
