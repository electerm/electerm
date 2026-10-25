/**
 * socks proxy wrapper
 */

const { request } = require('http')
const { isIP } = require('net')

/**
 * url hostname without the brackets a URL keeps around an IPv6 literal
 * @param {string} hostname
 * @return {string}
 */
function plainHostname (hostname) {
  return hostname.replace(/^\[(.*)\]$/, '$1')
}

/**
 * socks proxy address from a URL hostname
 * URL keeps the brackets around an IPv6 hostname ([::1]), which is not
 * something net.connect can resolve, so drop them, and use net.isIP so
 * compressed IPv6 forms like ::1 or fe80::1 count as an ip as well
 * @param {string} hostname
 * @return {object} {ipaddress} or {host}
 */
function proxyAddress (hostname) {
  const addr = plainHostname(hostname)
  return isIP(addr) ? { ipaddress: addr } : { host: addr }
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
        // same bracket problem as the socks branch below: http.request
        // connects to hostname, so '[::1]' goes to dns.lookup and fails.
        // `host` stays as proxyURL.host, where the brackets belong, since it
        // is what ends up in the Host header
        hostname: plainHostname(hostname),
        port: proxyPort,
        host: proxyHost,
        path: `${host}:${port}`,
        method: 'CONNECT',
        timeout: readyTimeout,
        headers: {}
      }
      if (username) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64')
        opts.headers['Proxy-Authorization'] = `Basic ${auth}`
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
  const options = {
    proxy: {
      ...proxyAddress(hostname),
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
  // use socks proxy
  const { SocksClient } = require('socks')
  return SocksClient.createConnection(options)
}

module.exports.proxyAddress = proxyAddress
