/**
 * nedb api wrapper
 */

const { appPath, defaultUserName } = require('../utils/app-props')
const { resolve } = require('path')
const Datastore = require('nedb')
const db = {}
const reso = (name) => {
  return resolve(appPath, 'electerm', 'users', defaultUserName, `electerm.${name}.nedb`)
}
const tables = [
  'bookmarks',
  'history',
  'jumpHosts',
  'bookmarkGroups',
  'themes',
  'lastStates',
  'userConfigs',
  'data',
  'orders',
  'quickCommands'
]

tables.forEach(table => {
  db[table] = new Datastore({
    filename: reso(table),
    autoload: true
  })
})

const dbAction = (dbName, op, ...args) => {
  return new Promise((resolve, reject) => {
    db[dbName][op](...args, (err, result, ...restResult) => {
      if (err) {
        return reject(err)
      }
      resolve({
        result,
        restResult
      })
    })
  })
}

module.exports = {
  dbAction,
  tables
}
