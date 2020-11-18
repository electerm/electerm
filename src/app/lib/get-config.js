const { dbAction } = require('./nedb')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')
const { userConfigId } = require('../common/constants')
const generate = require('../common/uid')

exports.getConfig = async () => {
  const token = generate()
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  delete userConfig._id
  const port = await getPort()
  const config = {
    ...defaultSetting,
    ...userConfig,
    port,
    tokenElecterm: token
  }
  return {
    userConfig,
    config
  }
}
