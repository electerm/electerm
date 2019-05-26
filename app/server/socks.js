/**
 * socks proxy wrapper
 */

let { SocksClient } = require('socks')
let { request } = require('http')

module.exports = (initOptions) => {
  let {
    proxy: {
      proxyIp,
      proxyPort,
      proxyType
    },
    readyTimeout,
    host,
    port
  } = initOptions
  const options = {
    proxy: {
      ipaddress: proxyIp,
      port: proxyPort,
      type: Number(proxyType)
    },

    command: 'connect',
    timeout: readyTimeout,

    destination: {
      host,
      port
    }
  }

  // use http proxy
  if (proxyType === '0') {
    return new Promise((resolve, reject) => {
      const opts = {
        agent: false,
        hostname: proxyIp,
        port: proxyPort,
        path: `${host}:${port}`,
        method: 'CONNECT',
        timeout: readyTimeout
      }
      request(opts)
        .on('error', (e) => {
          console.error(`fail to connect proxy: ${e.message}`)
          reject(e)
        })
        .on('connect', (res, socket) => {
          resolve({ socket: socket })
        })
        .end()
    })
  }

  // use socks proxy
  return SocksClient.createConnection(options)
}
