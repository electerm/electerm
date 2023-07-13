/**
 * socks proxy wrapper
 */

const { SocksClient } = require('socks')
const { request } = require('http')
const { isValidIP } = require('../common/is-ip')

function parseUrl (str) {
  try {
    return new URL(str)
  } catch (e) {
    console.log(e)
  }
}

module.exports = (initOptions) => {
  const {
    readyTimeout,
    host,
    port,
    proxy
  } = initOptions
  const proxyURL = parseUrl(proxy)
  if (!proxyURL) {
    throw new Error('proxy format not right:', proxy)
  }
  // use http proxy
  const {
    protocol,
    hostname,
    username,
    password
  } = proxyURL
  const proxyPort = Number(proxyURL.port)
  const proxyHost = proxyURL.host
  if (protocol === 'http:' || protocol === 'https:') {
    return new Promise((resolve, reject) => {
      const opts = {
        agent: false,
        protocol,
        hostname,
        port: proxyPort,
        path: proxyHost,
        method: 'CONNECT',
        timeout: readyTimeout
      }
      if (username) {
        opts.auth = `${username}:${password}`
      }
      request(opts)
        .on('error', (e) => {
          console.error(`fail to connect proxy: ${e.message}`)
          reject(e)
        })
        .on('connect', (res, socket) => {
          resolve({ socket })
        })
        .end()
    })
  }
  const type = protocol.includes('5') ? 5 : 4
  const isIp = isValidIP(hostname)
  const options = {
    proxy: {
      port: proxyPort,
      type,
      userId: username,
      password: password
    },

    command: 'connect',
    timeout: readyTimeout,

    destination: {
      host,
      port
    }
  }
  if (isIp) {
    options.proxy.ipaddress = hostname
  } else {
    options.proxy.host = hostname
  }

  // use socks proxy
  return SocksClient.createConnection(options)
}
