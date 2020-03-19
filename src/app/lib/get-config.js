const { dbAction } = require('./nedb')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')

module.exports = async () => {
  let userConfig = await dbAction('data', 'findOne', {
    _id: 'userConfig'
  })
  userConfig = userConfig ? userConfig.value : {}
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
