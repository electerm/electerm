const fs = require('fs')
const os = require('os')
const path = require('path')
const uid = require('../common/uid')
const FtpSrv = require('@electerm/ftp-srv')

// Passive data connections are opened by the client, so these ports have to be
// reachable through whatever firewall sits between the client and us. Keep them
// in a high, predictable range instead of letting the library scan from 1024.
const PASV_MIN_PORT = 50000
const PASV_MAX_PORT = 51000

// The old defaults exposed a LAN-reachable FTP server with known credentials
// rooted at $HOME. Keep the safe values for new instances and refuse to start
// saved instances that still carry the shipped password.
const SHARE_DIR = path.join(os.homedir(), 'electerm-ftp-share')
const LEGACY_PASSWORD = 'ftppass'
const WILDCARD_BINDS = ['', '0.0.0.0', '::', '[::]']

function isWildcardBind (host) {
  return WILDCARD_BINDS.includes(host)
}

function isHomeDir (dir) {
  return path.resolve(String(dir || '')) === path.resolve(os.homedir())
}

function urlHost (host) {
  const bare = host.replace(/^\[(.*)\]$/, '$1')
  return bare.includes(':') ? `[${bare}]` : bare
}

const widgetInfo = {
  name: 'Local FTP Server',
  description: 'A local FTP server to share files over FTP protocol.',
  version: '1.0.0',
  author: 'ZHAO Xudong',
  type: 'instance',
  builtin: true,
  configs: [
    {
      name: 'host',
      type: 'string',
      default: '127.0.0.1',
      description: 'The IP address to bind the FTP server to (default: loopback only; a wildcard bind exposes FTP to the LAN)'
    },
    {
      name: 'port',
      type: 'number',
      default: 2121,
      description: 'The port number to listen on'
    },
    {
      name: 'directory',
      type: 'string',
      default: SHARE_DIR,
      description: 'The directory to serve files from (default: ~/electerm-ftp-share, not the whole home directory)'
    },
    {
      name: 'anonymous',
      type: 'boolean',
      default: false,
      description: 'Allow anonymous FTP access'
    },
    {
      name: 'username',
      type: 'string',
      default: 'ftpuser',
      description: 'Username for FTP authentication (used when anonymous is false)'
    },
    {
      name: 'password',
      type: 'string',
      default: '',
      showGenerator: true,
      description: 'Password for FTP authentication (used when anonymous is false). Generate a unique one before starting; the old shipped default is rejected.'
    },
    {
      name: 'pasvUrl',
      type: 'string',
      default: '',
      description: 'Address to advertise in PASV replies (leave empty to auto-detect). Set this when the machine has several network interfaces or is behind NAT.'
    },
    {
      name: 'autoRun',
      type: 'boolean',
      default: false,
      description: 'Automatically start this FTP server when the app launches'
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

const noop = () => {}

// ftp-srv takes a pino-shaped logger (see its helpers/logger.js). Feeding it
// into the instance log buys a command-level trace of the server for free —
// including the client's own PASV/PORT/username lines — which is exactly what
// is missing when a client cannot connect but the port is open. The library
// masks PASS arguments itself.
function createFtpLogger (log) {
  const levelMap = {
    trace: 'debug',
    debug: 'debug',
    info: 'info',
    warn: 'warn',
    error: 'error',
    fatal: 'error'
  }
  const describe = (obj, msg) => {
    const parts = []
    if (msg) {
      parts.push(msg)
    }
    if (obj instanceof Error) {
      parts.push(obj.stack || obj.message)
    } else if (typeof obj === 'string') {
      parts.push(obj)
    } else if (obj && typeof obj === 'object') {
      parts.push(JSON.stringify(obj))
    }
    return parts.join(' ') || 'event'
  }
  const make = (bindings) => {
    const logger = {
      child: (b) => make({ ...bindings, ...b })
    }
    for (const name of Object.keys(levelMap)) {
      logger[name] = (obj, msg) => {
        const from = bindings.ip ? `[${bindings.ip}] ` : ''
        log(levelMap[name], from + describe(obj, msg))
      }
    }
    return logger
  }
  return make({})
}

function widgetRun (instanceConfig, ctx = {}) {
  const { log = noop, event = noop } = ctx
  const config = { ...getDefaultConfig(), ...instanceConfig }
  const instanceId = uid()
  let server = null

  const start = async () => {
    if (server) {
      throw new Error('Server is already running')
    }

    const bindHost = String(config.host || '127.0.0.1').trim().toLowerCase()
    const directory = path.resolve(String(config.directory || SHARE_DIR))
    if (!config.anonymous) {
      if (!config.password) {
        throw new Error('Set an FTP password before starting the server')
      }
      if (config.password === LEGACY_PASSWORD) {
        throw new Error('The shipped default FTP password is no longer accepted; generate a new one')
      }
    }
    if (config.anonymous && isHomeDir(directory)) {
      throw new Error('Anonymous FTP cannot use the home directory as its root')
    }
    if (isWildcardBind(bindHost)) {
      log('warn', `${widgetInfo.name} is binding to all interfaces; FTP credentials are sent in clear text`)
    }
    if (isHomeDir(directory)) {
      log('warn', `${widgetInfo.name} is serving the whole home directory`)
    }
    fs.mkdirSync(directory, { recursive: true })

    server = new FtpSrv({
      url: `ftp://${urlHost(bindHost)}:${config.port}`,
      anonymous: config.anonymous,
      root: directory,
      pasv_url: config.pasvUrl || undefined,
      pasv_min: PASV_MIN_PORT,
      pasv_max: PASV_MAX_PORT,
      log: createFtpLogger(log)
    })

    if (!config.anonymous) {
      server.on('login', ({ username, password, connection }, resolve, reject) => {
        const from = connection && connection.ip
        if (username === config.username && password === config.password) {
          event({
            type: 'login',
            ok: true,
            from,
            msg: `user ${username} accepted`
          })
          return resolve({ root: directory })
        }
        event({
          type: 'login',
          ok: false,
          from,
          msg: `user ${username} rejected: invalid username or password`
        })
        return reject(new Error('Invalid username or password'))
      })
    }

    server.on('connect', ({ connection, newConnectionCount }) => {
      event({
        type: 'connect',
        ok: true,
        from: connection && connection.ip,
        msg: `control connection opened, ${newConnectionCount} active`
      })
    })

    server.on('disconnect', ({ connection, newConnectionCount }) => {
      event({
        type: 'disconnect',
        ok: null,
        from: connection && connection.ip,
        msg: `control connection closed, ${newConnectionCount} active`
      })
    })

    server.on('client-error', ({ connection, context, error }) => {
      console.log('FTP client error:', error)
      event({
        type: 'client-error',
        ok: false,
        from: connection && connection.ip,
        msg: `${context}: ${error.message}`
      })
    })

    server.on('server-error', ({ error }) => {
      log('error', `server error: ${error && error.message ? error.message : error}`)
    })

    return new Promise((resolve, reject) => {
      server.listen()
        .then(() => {
          const baseUrl = `ftp://${urlHost(bindHost)}:${config.port}`
          // The copyable URL keeps the credentials; the status message and
          // console log must not leak them into notifications or log files.
          const url = config.anonymous
            ? baseUrl
            : `ftp://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@${urlHost(bindHost)}:${config.port}`
          const serverInfo = {
            url,
            path: directory
          }
          const msg = `${widgetInfo.name} is running at ${baseUrl}`
          log('info', `passive data ports ${PASV_MIN_PORT}-${PASV_MAX_PORT}, advertised address: ${config.pasvUrl || 'auto-detected'}`)
          console.log(msg)
          console.log(`Serving files from: ${serverInfo.path}`)
          resolve({ serverInfo, msg, success: true })
        })
        .catch(reject)
    })
  }

  const stop = () => {
    return new Promise((resolve, reject) => {
      if (server) {
        server.close()
          .then(() => {
            console.log(`${widgetInfo.name} has been stopped`)
            server = null
            resolve()
          })
          .catch((err) => {
            console.error('Error stopping the FTP server:', err)
            reject(err)
          })
      } else {
        console.log(`${widgetInfo.name} is not running`)
        resolve()
      }
    })
  }

  return {
    instanceId,
    start,
    stop
  }
}

module.exports = {
  widgetInfo,
  widgetRun
}
