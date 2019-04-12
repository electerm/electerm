/**
 * localstorage to local file system
 */

import {writeFileSync, readFileSync} from 'fs'
import _ from 'lodash'
import {resolve} from 'path'
import appPath from '../utils/app-path'

const savePath = resolve(appPath, 'electerm-localstorage.json')
const copy = require('json-deep-copy')
const log = require('../utils/log')

let cache = {}
let writeFs = _.debounce(writeFileSync, 280, {
  leading: true
})

const get = (key) => {
  try {
    let db = JSON.parse(readFileSync(savePath).toString())
    cache = db
    return db[key]
  } catch(e) {
    log.info('no electerm-localstorage.json, but it is ok.')
    return null
  }
}

const set = (keyOrObject, value) => {
  try {
    let newdb = copy(cache)
    if (_.isPlainObject(keyOrObject)) {
      Object.assign(newdb, keyOrObject)
    }
    else if (_.isUndefined(value) || _.isNull(value)) {
      delete newdb[keyOrObject]
    } else {
      newdb[keyOrObject] = value
    }
    cache = newdb
    writeFs(savePath, JSON.stringify(newdb))
  } catch(e) {
    log.error('ls set error', e)
  }
}

const clear = (key) => {
  return set(key, null)
}

export default {
  get,
  set,
  clear
}
