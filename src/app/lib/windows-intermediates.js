const os = require('os')
const tls = require('tls')
const systemCA = require('./system-ca')

async function installIntermediates () {
  const certs = await systemCA.readWindowsIntermediates()
  if (certs.size) {
    const pem = Array.from(certs, der => `-----BEGIN CERTIFICATE-----\n${der}\n-----END CERTIFICATE-----`)
    tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...pem])
  }
}

let pending
module.exports = function loadWindowsIntermediates () {
  if (os.platform() !== 'win32' || !tls.setDefaultCACertificates) return
  // Share the lookup across concurrent requests and both direct and proxy agents.
  pending ??= installIntermediates().catch(error => {
    pending = undefined
    console.warn('Unable to load Windows intermediate CAs:', error.message)
  })
  return pending
}
