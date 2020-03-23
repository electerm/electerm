const { dbAction } = require('./nedb')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')
const { userConfigId } = require('../common/constants')
const { initLang } = require('./locales')

exports.getConfig = async () => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  delete userConfig._id
  const port = await getPort()
  const config = {
    ...defaultSetting,
    ...userConfig,
    port
  }
  return {
    userConfig,
    config
  }
}

exports.getAllConfig = async () => {
  const { config } = await exports.getConfig()
  config.language = initLang(config)
  return config
}
