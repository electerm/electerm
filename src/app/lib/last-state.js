/**
 * set/get app last state
 */

const { dbAction } = require('./nedb')
const log = require('../common/log')
let count = 0
const set = (key, value) => {
  count = count + 1
  if (count > 100) {
    count = 0
    dbAction('compactDatafile').catch(log.error)
  }
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
