/**
 * nedb api wrapper
 */

const { appPath, defaultUserName } = require('../utils/app-props')
const { resolve } = require('path')
const Datastore = require('nedb')
const { existsSync } = require('fs')
const db = {}
const currentUserPath = resolve(
  appPath, 'electerm', 'current_user.txt'
)
let currentUser = defaultUserName
// const log = require('../utils/log')

try {
  if (existsSync(currentUserPath)) {
    currentUser = require('fs').readFileSync(currentUserPath).toString()
  }
} catch (e) {
  console.debug('read default user name error')
}

const reso = (name) => {
  return resolve(appPath, 'electerm', 'users', currentUser, `electerm.${name}.nedb`)
}
const tables = [
  'bookmarks',
  'history',
  'jumpHosts',
  'bookmarkGroups',
  'terminalThemes',
  'lastStates',
  'data',
  'quickCommands',
  'log',
  'dbUpgradeLog'
]

tables.forEach(table => {
  db[table] = new Datastore({
    filename: reso(table),
    autoload: true
  })
})

const dbAction = (dbName, op, ...args) => {
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
