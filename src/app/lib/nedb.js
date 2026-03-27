/**
 * nedb api wrapper
 * Accepts appPath and defaultUserName as parameters to avoid electron dependency
 */

const { resolve } = require('path')
const fs = require('fs')
const Datastore = require('@electerm/nedb')

// Tables whose stored data values should be encrypted at rest
const ENC_TABLES = new Set(['bookmarks', 'profiles', 'data'])

// Within the 'data' table, only this specific record is encrypted
const DATA_ENC_ID = 'userConfig'

// Prefix added to stored strings to mark them as encrypted
const ENC_PREFIX = 'enc:'

function createDb (appPath, defaultUserName, { enc, dec } = {}) {
  const db = {}

  const appDataPath = process.env.DATA_PATH || resolve(appPath, 'electerm')

  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true })
  }

  const reso = (name) => {
    return resolve(appDataPath, 'users', defaultUserName, `electerm.${name}.nedb`)
  }
  const tables = [
    'bookmarks',
    'bookmarkGroups',
    'addressBookmarks',
    'terminalThemes',
    'lastStates',
    'data',
    'quickCommands',
    'log',
    'dbUpgradeLog',
    'profiles',
    'workspaces'
  ]

  tables.forEach(table => {
    const conf = {
      filename: reso(table),
      autoload: true
    }
    db[table] = new Datastore(conf)
  })

  /**
   * Encrypt a plain JSON string for storage.
   * Returns the original string when encryption is not configured.
   */
  function encryptData (jsonStr) {
    if (!enc) return jsonStr
    return ENC_PREFIX + enc(jsonStr)
  }

  /**
   * Decrypt a stored string back to plain JSON.
   * Returns the original string when decryption is not configured or the
   * value was stored without encryption.
   */
  function decryptData (stored) {
    if (!dec || !stored) return stored
    if (!stored.startsWith(ENC_PREFIX)) return stored
    return dec(stored.slice(ENC_PREFIX.length))
  }

  /**
   * Returns true when a specific document in a specific table should be
   * encrypted. The 'data' table is selective: only _id === 'userConfig'.
   */
  function needsEnc (dbName, id) {
    if (!enc) return false
    if (dbName === 'data') return id === DATA_ENC_ID
    return ENC_TABLES.has(dbName)
  }

  /**
   * Wrap a result document by decrypting its `data` field when needed.
   * nedb stores the full document object directly, so we JSON-parse the
   * serialised data field that was encrypted during writes.
   */
  function decryptDoc (dbName, doc) {
    if (!dec || !doc || !needsEnc(dbName, doc._id)) return doc
    if (!doc._encdata) return doc
    try {
      const plain = decryptData(doc._encdata)
      const parsed = JSON.parse(plain)
      const { _encdata: _, ...rest } = doc
      return { ...rest, ...parsed }
    } catch (e) {
      return doc
    }
  }

  /**
   * Wrap a document for storage by encrypting its payload when needed.
   */
  function encryptDoc (dbName, doc) {
    if (!needsEnc(dbName, doc._id)) return doc
    const { _id, ...payload } = doc
    const jsonStr = JSON.stringify(payload)
    const encrypted = encryptData(jsonStr)
    return _id !== undefined ? { _id, _encdata: encrypted } : { _encdata: encrypted }
  }

  const dbAction = (dbName, op, ...args) => {
    if (op === 'compactDatafile') {
      db[dbName].persistence.compactDatafile()
      return
    }
    return new Promise((resolve, reject) => {
      if (op === 'find') {
        db[dbName][op](...args, (err, results) => {
          if (err) return reject(err)
          resolve((results || []).map(doc => decryptDoc(dbName, doc)))
        })
      } else if (op === 'findOne') {
        db[dbName][op](...args, (err, result) => {
          if (err) return reject(err)
          resolve(decryptDoc(dbName, result))
        })
      } else if (op === 'insert') {
        const original = args[0]
        const toInsert = Array.isArray(original)
          ? original.map(d => encryptDoc(dbName, d))
          : encryptDoc(dbName, original)
        db[dbName][op](toInsert, (err, inserted) => {
          if (err) return reject(err)
          // Return documents with original (unencrypted) fields + _id
          if (Array.isArray(original)) {
            const origArr = Array.isArray(inserted) ? inserted : [inserted]
            resolve(origArr.map((ins, i) => ({ ...original[i], _id: ins._id })))
          } else {
            resolve({ ...original, _id: inserted._id })
          }
        })
      } else if (op === 'update') {
        const [query, updateObj, options] = args
        const qid = query._id || query.id
        if (needsEnc(dbName, qid)) {
          const newData = updateObj.$set || updateObj
          const { _id: _ignored, ...payload } = newData
          const encDoc = encryptDoc(dbName, { _id: qid, ...payload })
          const finalUpdate = updateObj.$set ? { $set: encDoc } : encDoc
          db[dbName][op](query, finalUpdate, options || {}, (err, result) => {
            if (err) return reject(err)
            resolve(result)
          })
        } else {
          db[dbName][op](...args, (err, result) => {
            if (err) return reject(err)
            resolve(result)
          })
        }
      } else {
        db[dbName][op](...args, (err, result) => {
          if (err) return reject(err)
          resolve(result)
        })
      }
    })
  }

  return {
    dbAction,
    tables
  }
}

module.exports = {
  createDb
}
