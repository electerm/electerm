/**
 * set/get app last state
 */

const ls = require('./ls')

const set = (key, value) => {
  ls.set(`laststate.${key}`, value)
}

const get = (key) => {
  return ls.get(`laststate.${key}`)
}

const clear = (key) => {
  ls.clear(`laststate.${key}`)
}

module.exports = {
  set,
  get,
  clear
}
