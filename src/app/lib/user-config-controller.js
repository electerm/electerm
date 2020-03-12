
/**
 * user-controll.json controll
 */

const { dbAction } = require('./nedb')
const { userConfigId } = require('../common/constants')

exports.saveUserConfig = (conf) => {
  const q = {
    _id: userConfigId
  }
  dbAction('data', 'update', q, {
    ...q,
    ...conf
  }, {
    upsert: true
  })
}
