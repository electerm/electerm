const os = require('os')
// const path = require('path')
const express = require('express')
const uid = require('../common/uid')

const widgetInfo = {
  name: 'Static File Server',
  description: 'A simple local file server to serve static files from your computer.',
  version: '1.0.0',
  author: 'ZHAO Xudong',
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
      default: os.homedir(),
      description: 'The directory to serve files from (default: user\'s home directory)'
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
      default: 'allow',
      choices: ['allow', 'deny', 'ignore'],
      description: 'Option for serving dotfiles'
    },
    {
      name: 'acceptRanges',
      type: 'boolean',
      default: true,
      description: 'Enable or disable accepting ranged requests'
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

function widgetRun (instanceConfig) {
  const config = { ...getDefaultConfig(), ...instanceConfig }
  const instanceId = uid()
  let server = null
  const app = express()

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
      app.use(express.static(directory, rest))

      server = app.listen(port, host, (err) => {
        if (err) {
          console.error(`Failed to start ${widgetInfo.name}:`, err)
          reject(err)
        } else {
          const serverInfo = {
            url: `http://${host}:${port}`,
            path: directory
          }
          console.log(`${widgetInfo.name} is running at ${serverInfo.url}`)
          console.log(`Serving files from: ${serverInfo.path}`)
          resolve(serverInfo)
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
