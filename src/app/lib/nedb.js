/**
 * nedb api wrapper
 */

const { appPath, defaultUserName } = require('../common/app-props')
const { resolve } = require('path')
const fs = require('fs')
const Datastore = require('@electerm/nedb')
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
  'profiles'
]

tables.forEach(table => {
  const conf = {
    filename: reso(table),
    autoload: true
  }
  db[table] = new Datastore(conf)
})

const dbAction = (dbName, op, ...args) => {
  if (op === 'compactDatafile') {
    db[dbName].persistence.compactDatafile()
    return
  }
  return new Promise((resolve, reject) => {
    db[dbName][op](...args, (err, result) => {
      if (err) {
        return reject(err)
      }
      resolve(result)
    })
  })
}

module.exports = {
  dbAction,
  tables
}
