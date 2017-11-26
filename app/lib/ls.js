/**
 * localstorage to local file system
 */

const {writeFileSync, readFileSync} = require('fs')
const _ = require('lodash')
const {resolve} = require('path')
const savePath = resolve(__dirname, '../localstorage.json')
const copy = require('json-deep-copy')

let cache = {}

const get = (key) => {
  try {
    let db = JSON.parse(readFileSync(savePath).toString())
    cache = db
    return db[key]
  } catch(e) {
    console.log(e)
    return null
  }
}

const set = (key, value) => {
  try {
    let newdb = copy(cache)
    if (_.isUndefined(value) || _.isNull(value)) {
      delete cache[key]
    } else {
      newdb[key] = value
    }
    writeFileSync(savePath, JSON.stringify(newdb))
  } catch(e) {
    console.log(e)
  }
}

const clear = (key) => {
  return set(key, null)
}

module.exports = {
  get,
  set,
  clear
}
