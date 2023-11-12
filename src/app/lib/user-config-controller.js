/**
 * user-controll.json controll
 */

const { dbAction } = require('./nedb')
const { userConfigId } = require('../common/constants')
const { getDbConfig } = require('./get-config')

exports.saveUserConfig = async (userConfig) => {
  const q = {
    _id: userConfigId
  }
  delete userConfig.host
  delete userConfig.terminalTypes
  delete userConfig.tokenElecterm
  delete userConfig.server
  delete userConfig.port
  Object.assign(
    global.et.config,
    userConfig
  )
  const conf = await getDbConfig()
  return dbAction('data', 'update', q, {
    ...q,
    ...conf,
    ...userConfig
  }, {
    upsert: true
  })
}
