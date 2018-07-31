/**
 * socks proxy wrapper
 */

let {SocksClient} = require('socks')

module.exports = (initOptions) => {
  let {
    proxy: {
      proxyIp,
      proxyPort,
      proxyType
    },
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

    destination: {
      host,
      port
    }
  }
  return SocksClient.createConnection(options)
}
