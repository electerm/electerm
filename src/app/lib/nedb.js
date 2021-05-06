/**
 * nedb api wrapper
 */

const { appPath, defaultUserName } = require('../utils/app-props')
const { resolve } = require('path')
const { encrypt, decrypt } = require('./simple-enc')
const Datastore = require('nedb')
const { existsSync } = require('fs')
const db = {}
const currentUserPath = resolve(
  appPath, 'electerm', 'current_user.txt'
)
let currentUser = defaultUserName
const prefix = '####enced####'
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
  const conf = {
    filename: reso(table),
    autoload: true
  }
  // if (table === tables[0]) {
  //   conf.afterSerialization = str => {
  //     console.log('ff1', str)
  //     return str
  //   }
  //   conf.beforeDeserialization = str => {
  //     if (str.startsWith(prefix)) {
  //       console.log('ff')
  //       return decrypt(str.replace(prefix, ''))
  //     }
  //     return str
  //   }
  // }
  db[table] = new Datastore(conf)
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
