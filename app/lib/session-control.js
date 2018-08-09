/**
 * session control,
 * remove all session records from localstorage when exit normally
 */

const ls = require('./ls')
const KEY = 'sessions'

const set = (key, value) => {
  ls.set(`${KEY}.${key}`, value)
}

const get = (key) => {
  return ls.get(`${KEY}.${key}`)
}

const clear = (key) => {
  ls.clear(`${KEY}.${key}`)
}

module.exports = {
  set,
  get,
  clear
}
