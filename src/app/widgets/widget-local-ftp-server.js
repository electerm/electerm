const os = require('os')
const uid = require('../common/uid')
const { customRequire } = require('../lib/custom-require')

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
  let FtpSrv = null

  const start = async () => {
    if (server) {
      throw new Error('Server is already running')
    }

    FtpSrv = await customRequire('ftp-srv', {
      isCustomModule: true,
      downloadModule: true
    })

    server = new FtpSrv({
      url: `ftp://${config.host}:${config.port}`,
      anonymous: config.anonymous,
      root: config.directory
    })

    if (!config.anonymous) {
      server.on('login', ({ username, password }, resolve, reject) => {
        if (username === config.username && password === config.password) {
          return resolve({ root: config.directory })
        }
        return reject(new Error('Invalid username or password'))
      })
    }

    server.on('client-error', ({ connection, context, error }) => {
      console.log('FTP client error:', error)
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
          console.log(msg)
          console.log(`Serving files from: ${serverInfo.path}`)
          if (!config.anonymous) {
            console.log(`Login credentials: ${config.username} / ${config.password}`)
          } else {
            console.log('Anonymous access enabled')
          }
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
