const { dbAction } = require('./nedb')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')
const { userConfigId } = require('../common/constants')
const generate = require('../common/uid')

exports.getConfig = async (inited) => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  delete userConfig._id
  delete userConfig.host
  delete userConfig.terminalTypes
  delete userConfig.tokenElecterm
  const port = inited
    ? global.et.config.port
    : await getPort()
  const config = {
    ...defaultSetting,
    ...userConfig,
    port,
    tokenElecterm: inited ? global.et.config.tokenElecterm : generate()
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
