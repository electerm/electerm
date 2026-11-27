const iconv = require('iconv-lite')
const log = require('../common/log')
const { pick } = require('../lib/lodash')
const { TerminalBase } = require('./session-base')
const { commonExtends } = require('./session-common')
const globalState = require('./global-state')
const { SshTunnelManager } = require('./ssh-tunnel-manager')
const { connectFirst } = require('./session-ssh/connect')
const { connectHops, firstHopOptions } = require('./session-ssh/hops')
const { InteractivePrompts } = require('./session-ssh/prompts')
const { prepareX11 } = require('./x11')

const utf8Aliases = new Set(['utf-8', 'utf8', 'utf-8-strict'])

class TerminalSsh extends TerminalBase {
  constructor (options, ws, isTest) {
    super(firstHopOptions(options), ws, isTest)
    this.prompts = new InteractivePrompts(this)
  }

  async init () {
    const { initOptions } = this
    try {
      if (initOptions.x11 === true) await prepareX11(this)
      this.conn = await connectFirst(this)
      if (initOptions.connectionHoppings?.length) {
        await connectHops(this, initOptions.connectionHoppings)
      }
      if (this.isTest) {
        this.kill()
        return
      }
      if (initOptions.enableSsh !== false) {
        await this.startTunnels()
        await this.openShell()
      }
      globalState.setSession(this.pid, this)
      return this
    } catch (err) {
      this.kill()
      throw err
    }
  }

  async startTunnels () {
    this.tunnelManager = new SshTunnelManager(this.conn)
    for (const tunnel of this.initOptions.sshTunnels || []) {
      if (tunnel?.sshTunnel) await this.tunnelManager.add(tunnel, false)
    }
    const sshTunnelResults = this.tunnelManager.list()
    if (this.ws) {
      this.ws.s({
        update: { sshTunnelResults },
        action: 'ssh-tunnel-result',
        tabId: this.initOptions.srcTabId
      })
    } else {
      this.sshTunnelResults = sshTunnelResults
    }
  }

  async manageTunnel ({ command, tunnelId, tunnel }) {
    if (!this.tunnelManager || !this.conn) throw new Error('SSH session disconnected')
    if (command === 'add') {
      if (!tunnel || typeof tunnel.sshTunnel !== 'string') throw new Error('Invalid SSH tunnel')
      await this.tunnelManager.add(tunnel, true)
    } else if (command === 'start' || command === 'stop') {
      await this.tunnelManager.change(command, tunnelId)
    } else if (command === 'remove') {
      await this.tunnelManager.remove(tunnelId)
    } else if (command !== 'list') {
      throw new Error('Unknown tunnel command')
    }
    return this.tunnelManager.list()
  }

  shell (conn, window, options) {
    return new Promise((resolve, reject) => {
      conn.shell(window, options, (err, channel) => {
        if (err) reject(err)
        else resolve(channel)
      })
    })
  }

  async openShell () {
    const { conn, initOptions } = this
    const window = pick(initOptions, ['rows', 'cols', 'term'])
    const options = {
      env: this.getEnv(),
      x11: initOptions.x11 === true ? { cookie: this.x11Cookie } : undefined
    }
    try {
      this.channel = await this.shell(conn, window, options)
    } catch (err) {
      // ssh2 rejects the entire shell when the server refuses agent forwarding.
      if (err.message !== 'Unable to request agent forwarding' || !conn.config?.allowAgentFwd) throw err
      conn.config.allowAgentFwd = false
      this.channel = await this.shell(conn, window, options)
    }
    this.setNoDelay(true)
  }

  resize (cols, rows) {
    this.channel?.setWindow(rows, cols)
  }

  get outputStreams () {
    return [this.channel, this.channel?.stderr]
  }

  on (event, cb) {
    for (const stream of this.outputStreams) stream?.on(event, cb)
  }

  off (event, cb) {
    for (const stream of this.outputStreams) stream?.removeListener(event, cb)
  }

  write (data) {
    const encode = this.connectOptions?.encode || this.initOptions?.encode
    if (encode && !utf8Aliases.has(encode.toLowerCase()) && typeof data === 'string') {
      try {
        data = iconv.encode(data, encode)
      } catch (e) {
        log.warn('iconv encode failed, falling back to raw write:', e.message)
      }
    }
    this.channel?.write(data)
  }

  setNoDelay (noDelay = true) {
    try {
      this.conn?.setNoDelay?.(noDelay)
    } catch (e) {
      log.warn('failed to set ssh noDelay', e)
    }
  }

  kill () {
    this.prompts.abort()
    this.channel?.end()
    delete this.channel
    for (const conn of new Set([this.conn, ...(this.conns || []), this.nextConn])) {
      conn?.end()
    }
    this.proxyCommandDispose?.()
    this.sessionLogger?.destroy()
    delete this.sessionLogger
    this._vtTerm?.dispose()
    delete this._vtTerm
    // A failed attempt can have the same pid as a working session.
    if (globalState.getSession(this.pid) === this) this.onEndConn()
    delete this.ws
    this.conn = null
    this.conns = null
    this.nextConn = null
    this.proxyCommandDispose = null
    this.initOptions = null
    this.connectOptions = null
  }
}

commonExtends(TerminalSsh)

exports.session = (options, ws) => new TerminalSsh(options, ws).init()

exports.test = async (options, ws) => {
  try {
    await new TerminalSsh(options, ws, true).init()
    return true
  } catch (err) {
    log.error('test ssh error', err)
    return false
  }
}
