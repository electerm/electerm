/**
 * localstorage to local file system
 */

const { writeFileSync, readFileSync } = require('fs')
const _ = require('lodash')
const { resolve } = require('path')
const { appPath } = require('../utils/app-props')
const savePath = resolve(appPath, 'electerm-localstorage.json')
const copy = require('json-deep-copy')
const log = require('../utils/log')

let cache = {}
const writeFs = _.debounce(writeFileSync, 280, {
  leading: true
})

const get = (key) => {
  try {
    const db = JSON.parse(readFileSync(savePath).toString())
    cache = db
    return db[key]
  } catch (e) {
    log.info('no electerm-localstorage.json, but it is ok.')
    return null
  }
}

const set = (keyOrObject, value) => {
  try {
    const newdb = copy(cache)
    if (_.isPlainObject(keyOrObject)) {
      Object.assign(newdb, keyOrObject)
    } else if (_.isUndefined(value) || _.isNull(value)) {
      delete newdb[keyOrObject]
    } else {
      newdb[keyOrObject] = value
    }
    cache = newdb
    writeFs(savePath, JSON.stringify(newdb))
  } catch (e) {
    log.error('ls set error', e)
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
