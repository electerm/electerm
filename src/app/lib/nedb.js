/**
 * nedb api wrapper
 */

const { appPath, defaultUserName } = require('../common/app-props')
const { resolve } = require('path')
const Datastore = require('@yetzt/nedb')
const db = {}

const reso = (name) => {
  return resolve(appPath, 'electerm', 'users', defaultUserName, `electerm.${name}.nedb`)
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
