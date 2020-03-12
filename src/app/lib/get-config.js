const { dbAction } = require('./nedb')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')

module.exports = async () => {
  const userConf = await dbAction('data', 'findOne', {
    _id: 'userConfig'
  })
  const port = getPort()
  return {
    ...defaultSetting,
    ...(userConf || {}),
    port
  }
}
