const log = require('../common/log')
const { appPath, defaultUserName } = require('../common/app-props')
const { safeEncrypt, safeDecrypt } = require('./safe-storage')
const { resolve: pathResolve } = require('path')
const fs = require('fs')
const { randomBytes } = require('crypto')

const appDataPath = process.env.DATA_PATH || pathResolve(appPath, 'electerm')
const keyFilePath = pathResolve(appDataPath, 'users', defaultUserName, 'storage-key.enc')

let _cachedStorageKey = null

function getStorageKey () {
  if (_cachedStorageKey) return _cachedStorageKey
  let key = null
  try {
    if (fs.existsSync(keyFilePath)) {
      const enc = fs.readFileSync(keyFilePath, 'utf8').trim()
      const dec = safeDecrypt(enc)
      if (dec && dec !== enc) {
        key = dec
      } else if (dec && !enc.startsWith('v2:safe:')) {
        key = dec
      }
    }
  } catch (e) {
    log.error('[storage-key] read error:', e.message)
  }
  if (!key) {
    key = randomBytes(32).toString('base64')
    try {
      const dir = pathResolve(appDataPath, 'users', defaultUserName)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const enc = safeEncrypt(key)
      fs.writeFileSync(keyFilePath, enc, 'utf8')
    } catch (e) {
      log.error('[storage-key] write error:', e.message)
    }
  }
  _cachedStorageKey = key
  return key
}

module.exports = { getStorageKey }
