/**
 * terminal/sftp/serial class
 */
const {
  terminalTelnet,
  testConnectionTelnet
} = require('./session-telnet')
const {
  terminalSsh,
  testConnectionSsh
} = require('./session-ssh')
const {
  terminalLocal,
  testConnectionLocal
} = require('./session-local')
const {
  terminalSerial,
  testConnectionSerial
} = require('./session-serial')
const {
  terminalRdp,
  testConnectionRdp
} = require('./session-rdp')
const {
  terminalVnc,
  testConnectionVnc
} = require('./session-vnc')

exports.terminal = async function (initOptions, ws) {
  const type = initOptions.termType || initOptions.type
  if (type === 'telnet') {
    return terminalTelnet(initOptions, ws)
  } else if (type === 'serial') {
    return terminalSerial(initOptions, ws)
  } else if (type === 'local') {
    return terminalLocal(initOptions, ws)
  } else if (type === 'rdp') {
    return terminalRdp(initOptions, ws)
  } else if (type === 'vnc') {
    return terminalVnc(initOptions, ws)
  } else {
    return terminalSsh(initOptions, ws)
  }
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnection = (initOptions) => {
  const type = initOptions.termType || initOptions.type
  if (type === 'telnet') {
    return testConnectionTelnet(initOptions)
  } else if (type === 'local') {
    return testConnectionLocal(initOptions)
  } else if (type === 'serial') {
    return testConnectionSerial(initOptions)
  } else if (type === 'rdp') {
    return testConnectionRdp(initOptions)
  } else if (type === 'vnc') {
    return testConnectionVnc(initOptions)
  } else {
    return testConnectionSsh(initOptions)
  }
}
