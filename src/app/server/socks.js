/**
 * socks proxy wrapper
 */

const { request } = require('http')

function isValidIP (input) {
  // Check IPv4 format
  const ipv4Pattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Pattern.test(input)) {
    return true
  }

  // Check IPv6 format
  const ipv6Pattern = /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i
  if (ipv6Pattern.test(input)) {
    return true
  }

  // If input doesn't match IPv4 or IPv6 patterns, it's not a valid IP
  return false
}

function parseUrl (str) {
  try {
    return new URL(str)
  } catch (e) {
    console.log(`parse url error: ${e.message}, url: ${str}`)
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
        host: proxyHost,
        path: `${host}:${port}`,
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
      password
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
  const { SocksClient } = require('socks')
  return SocksClient.createConnection(options)
}
