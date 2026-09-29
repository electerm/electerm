const os = require('os')
const uid = require('../common/uid')
const FtpSrv = require('@electerm/ftp-srv')

// Passive data connections are opened by the client, so these ports have to be
// reachable through whatever firewall sits between the client and us. Keep them
// in a high, predictable range instead of letting the library scan from 1024.
const PASV_MIN_PORT = 50000
const PASV_MAX_PORT = 51000

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
      default: '0.0.0.0',
      description: 'The IP address to bind the FTP server to'
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
      default: os.homedir(),
      description: 'The directory to serve files from (default: user\'s home directory)'
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
      default: 'ftppass',
      description: 'Password for FTP authentication (used when anonymous is false)'
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

    server = new FtpSrv({
      url: `ftp://${config.host}:${config.port}`,
      anonymous: config.anonymous,
      root: config.directory,
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
          return resolve({ root: config.directory })
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
          const url = config.anonymous
            ? `ftp://${config.host}:${config.port}`
            : `ftp://${config.username}:${config.password}@${config.host}:${config.port}`
          const serverInfo = {
            url,
            path: config.directory
          }
          const msg = `${widgetInfo.name} is running at ${serverInfo.url}`
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
