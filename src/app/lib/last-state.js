/**
 * set/get app last state
 */

import ls from './ls'

const set = (key, value) => {
  ls.set(`laststate.${key}`, value)
}

const get = (key) => {
  return ls.get(`laststate.${key}`)
}

const clear = (key) => {
  ls.clear(`laststate.${key}`)
}

export default {
  get,
  clear,
  set
}
