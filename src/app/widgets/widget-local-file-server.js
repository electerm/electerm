const os = require('os')
const fs = require('fs')
const path = require('path')
const express = require('express')
const uid = require('../common/uid')

const SHARE_DIR = path.join(os.homedir(), 'electerm-share')

const widgetInfo = {
  name: 'Static File Server',
  description: 'A simple local file server to serve static files from your computer.',
  version: '1.0.0',
  author: 'ZHAO Xudong',
  type: 'instance',
  builtin: true,
  configs: [
    {
      name: 'host',
      type: 'string',
      default: '127.0.0.1',
      description: 'The IP address to bind the server to'
    },
    {
      name: 'port',
      type: 'number',
      default: 3456,
      description: 'The port number to listen on'
    },
    {
      name: 'directory',
      type: 'string',
      default: SHARE_DIR,
      description: 'The directory to serve files from (default: ~/electerm-share, not the whole home directory)'
    },
    {
      name: 'maxAge',
      type: 'number',
      default: 365 * 24 * 60 * 60 * 1000,
      description: 'Browser cache max-age in milliseconds'
    },
    // {
    //   name: 'immutable',
    //   type: 'boolean',
    //   default: false,
    //   description: 'Enable or disable the immutable directive in the Cache-Control header'
    // },
    {
      name: 'cacheControl',
      type: 'boolean',
      default: true,
      description: 'Enable or disable setting Cache-Control response header'
    },
    {
      name: 'lastModified',
      type: 'boolean',
      default: true,
      description: 'Enable or disable the Last-Modified header'
    },
    {
      name: 'etag',
      type: 'boolean',
      default: true,
      description: 'Enable or disable etag generation'
    },
    // {
    //   name: 'extensions',
    //   type: 'array',
    //   default: [],
    //   description: 'Array of file extensions to try when resolving a file'
    // },
    // {
    //   name: 'fallthrough',
    //   type: 'boolean',
    //   default: true,
    //   description: 'Let client errors fall-through as unhandled requests'
    // },
    {
      name: 'index',
      type: 'string',
      default: 'index.html',
      description: 'Name of the index file to serve'
    },
    {
      name: 'redirect',
      type: 'boolean',
      default: true,
      description: 'Enable or disable redirects when pathname is a directory'
    },
    // {
    //   name: 'setHeaders',
    //   type: 'function',
    //   default: null,
    //   description: 'Function for setting custom headers (e.g., (res, path, stat) => { res.set("X-Custom-Header", "value"); })'
    // },
    {
      name: 'dotfiles',
      type: 'string',
      default: 'deny',
      choices: ['allow', 'deny', 'ignore'],
      description: 'Option for serving dotfiles (denied by default)'
    },
    {
      name: 'acceptRanges',
      type: 'boolean',
      default: true,
      description: 'Enable or disable accepting ranged requests'
    },
    {
      name: 'autoRun',
      type: 'boolean',
      default: false,
      description: 'Automatically run this widget when the app launches'
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

// Keep in sync with the loopback guard in widget-mcp-server.js. Binding to
// 127.0.0.1 does not make a server private: a page served from an attacker
// domain can rebind that domain to loopback and talk to us same-origin, so
// CORS never applies. The Host it claims and the presence of Origin are what
// is left to check. Unlike the MCP server we have no token, so a wildcard
// bind cannot be Host-checked at all — Origin is still rejected there.
const WILDCARD_BINDS = ['', '0.0.0.0', '::', '[::]']

function isWildcardBind (host) {
  return WILDCARD_BINDS.includes(host)
}

function loopbackAliases (host) {
  const bare = host.replace(/^\[(.*)\]$/, '$1')
  if (bare !== '127.0.0.1' && bare !== 'localhost' && bare !== '::1') {
    return []
  }
  return ['127.0.0.1', 'localhost', '::1', '[::1]']
}

function buildAllowedHosts (host, port) {
  const out = new Set()
  for (const h of [host, ...loopbackAliases(host)]) {
    out.add(h)
    out.add(`${h}:${port}`)
  }
  return out
}

const noop = () => {}

function widgetRun (instanceConfig, ctx = {}) {
  const { log = noop, event = noop } = ctx
  const config = { ...getDefaultConfig(), ...instanceConfig }
  const instanceId = uid()
  let server = null
  const app = express()

  // Registered before express.static (which start() adds later) so every
  // request is reported, including the 404s that explain a client's problem.
  app.use((req, res, next) => {
    const startedAt = Date.now()
    res.on('finish', () => {
      const ok = res.statusCode < 400
      event({
        type: req.method,
        ok,
        from: req.socket && req.socket.remoteAddress,
        msg: `${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
      })
      if (!ok) {
        log('warn', `${req.method} ${req.originalUrl} -> ${res.statusCode}`)
      }
    })
    next()
  })

  const start = () => {
    return new Promise((resolve, reject) => {
      if (server) {
        reject(new Error('Server is already running'))
        return
      }
      const {
        directory,
        port,
        host,
        ...rest
      } = config
      const bindHost = String(host || '127.0.0.1').trim().toLowerCase()
      const checkHost = !isWildcardBind(bindHost)
      // port 0 is used by tests; the real port is only known in the listen
      // callback, so build the allowlist per request from the current value.
      let boundPort = port

      const deny = (req, res, reason) => {
        const msg = `${req.method} ${req.originalUrl} -> 403 ${reason}`
        event({
          type: req.method,
          ok: false,
          from: req.socket && req.socket.remoteAddress,
          msg
        })
        log('warn', msg)
        res.status(403).send(`Forbidden: ${reason}`)
      }

      // Both checks must run before express.static. A rebound page is
      // same-origin with us, so CORS would not help; the Host it can claim
      // and the presence of Origin are the only browser-side tells we get.
      app.use((req, res, next) => {
        if (req.headers.origin) {
          deny(req, res, 'unexpected Origin header')
          return
        }
        if (checkHost) {
          const hostHeader = String(req.headers.host || '').trim().toLowerCase()
          if (!buildAllowedHosts(bindHost, boundPort).has(hostHeader)) {
            deny(req, res, 'invalid Host header')
            return
          }
        }
        next()
      })

      fs.mkdirSync(directory, { recursive: true })
      app.use(express.static(directory, rest))

      server = app.listen(port, host, (err) => {
        if (err) {
          console.error(`Failed to start ${widgetInfo.name}:`, err)
          reject(err)
        } else {
          const address = server.address()
          const actualPort = address && typeof address === 'object' ? address.port : port
          boundPort = actualPort
          const serverInfo = {
            url: `http://${host}:${actualPort}`,
            path: directory
          }
          const msg = `${widgetInfo.name} is running at ${serverInfo.url}`
          log('info', `serving ${serverInfo.path} on ${bindHost}:${actualPort}`)
          console.log(msg)
          console.log(`Serving files from: ${serverInfo.path}`)
          resolve({ serverInfo, msg, success: true })
        }
      })

      server.on('error', (err) => {
        console.error(`${widgetInfo.name} encountered an error:`, err)
        reject(err)
      })
    })
  }

  const stop = () => {
    return new Promise((resolve, reject) => {
      if (server) {
        server.close((err) => {
          if (err) {
            console.error('Error stopping the server:', err)
            reject(err)
          } else {
            console.log(`${widgetInfo.name} has been stopped`)
            server = null
            resolve()
          }
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
