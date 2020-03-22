/**
 * set/get app last state
 */

const { dbAction } = require('./nedb')
const log = require('../utils/log')

const set = (key, value) => {
  return dbAction('lastStates', 'update', {
    _id: key
  }, {
    _id: key,
    value
  }, {
    upsert: true
  })
}

const get = async (key) => {
  const res = await dbAction('lastStates', 'findOne', {
    _id: key
  })
    .catch(e => {
      log.error(e)
      log.error('last state get error')
    })
  return res ? res.value : null
}

const clear = (key) => {
  const q = key
    ? { _id: key }
    : {}
  return dbAction('lastStates', 'remove', q)
}

module.exports = {
  set,
  get,
  clear
}
