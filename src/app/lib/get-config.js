const { dbAction } = require('./db')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')
const { userConfigId, userNoEncryptConfigId } = require('../common/constants')
const generate = require('../common/uid')
const globalState = require('./glob-state')

// `pasteWhenContextMenu` (boolean) was replaced by `rightClickBehavior`
// ('context' | 'paste' | 'passthrough'). Configs saved by an older version
// still carry the boolean, so translate it once here — where the stored
// config first meets the defaults — and drop the dead key so the next save
// does not write it back.
function migrateRightClickBehavior (userConfig) {
  if (userConfig.rightClickBehavior === undefined) {
    userConfig.rightClickBehavior = userConfig.pasteWhenContextMenu
      ? 'paste'
      : defaultSetting.rightClickBehavior
  }
  delete userConfig.pasteWhenContextMenu
}

exports.getConfig = async (inited) => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  const requireAuth = userConfig.hashedPassword
  delete userConfig._id
  delete userConfig.host
  delete userConfig.terminalTypes
  delete userConfig.tokenElecterm
  delete userConfig.hashedPassword
  delete userConfig.salt
  migrateRightClickBehavior(userConfig)
  const port = inited
    ? globalState.get('config').port
    : await getPort()
  const config = {
    ...defaultSetting,
    ...userConfig,
    requireAuth,
    port,
    tokenElecterm: inited ? globalState.get('config').tokenElecterm : generate()
  }
  return {
    userConfig,
    config
  }
}

exports.getDbConfig = async () => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  return userConfig
}

exports.getUserConfigNoEnc = async () => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userNoEncryptConfigId
  }) || {}
  return userConfig
}
