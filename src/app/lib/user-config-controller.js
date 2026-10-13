/**
 * user-controll.json controll
 */

const { dbAction } = require('./db')
const { userConfigId, userNoEncryptConfigId } = require('../common/constants')
const { getDbConfig } = require('./get-config')
const globalState = require('./glob-state')
const log = require('../common/log')

const configNoEncryptFields = ['allowMultiInstance']

function hasNoEncryptFields (userConfig) {
  for (const f of configNoEncryptFields) {
    if (f in userConfig) {
      return true
    }
  }
  return false
}

exports.saveUserConfig = async (userConfig) => {
  const q = {
    _id: userConfigId
  }
  delete userConfig.host
  delete userConfig.terminalTypes
  delete userConfig.tokenElecterm
  delete userConfig.server
  delete userConfig.port
  globalState.update('config', userConfig)
  // `debug` is the one setting that changes the log level itself, and the app
  // is already running when it is flipped -- apply it here so the trace shows
  // up without a restart (the server child picks it up per session, see
  // ../server/session-ssh.js)
  if ('debug' in userConfig) {
    log.setDebugMode(!!userConfig.debug)
  }
  const conf = await getDbConfig()
  if (hasNoEncryptFields(userConfig)) {
    const q1 = {
      _id: userNoEncryptConfigId
    }
    const noEncryptConfig = {}
    for (const f of configNoEncryptFields) {
      if (f in userConfig) {
        noEncryptConfig[f] = userConfig[f]
      }
    }
    await dbAction('data', 'update', q1, noEncryptConfig, {
      upsert: true
    })
  }
  return dbAction('data', 'update', q, {
    ...q,
    ...conf,
    ...userConfig
  }, {
    upsert: true
  })
}
