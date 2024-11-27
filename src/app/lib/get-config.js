const { dbAction } = require('./nedb')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')
const { userConfigId } = require('../common/constants')
const generate = require('../common/uid')
const globalState = require('./glob-state')

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
