/**
 * migrate from NeDB (v1) to SQLite (v2)
 */

const { resolve } = require('path')
const { existsSync, renameSync } = require('fs')
const { appPath, defaultUserName } = require('../common/app-props')
const log = require('../common/log')

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

/**
 * Check if migration from v1 (NeDB) to v2 (SQLite) is needed
 * @returns {boolean} true if migration is needed
 */
function checkMigrate () {
  if (process.versions.node < '22.0.0') {
    return false
  }
  // Check if any NeDB files exist
  for (const table of tables) {
    const nedbPath = reso(table)
    if (existsSync(nedbPath)) {
      return true
    }
  }
  return false
}

/**
 * Migrate all data from NeDB to SQLite and backup NeDB files
 */
async function migrate () {
  log.info('Starting migration from NeDB (v1) to SQLite (v2)...')
  // nedb-instance: raw nedb without enc/dec (legacy data was never encrypted)
  const { dbAction: nedbDbAction } = require('./nedb-instance')
  // Use plain sqlite (no enc/dec) for migration writes: safeStorage encryption
  // is not reliable across restarts in the IPC/migration context. The app's
  // normal read/write path will encrypt data on the next user-triggered write.
  const { appPath, defaultUserName } = require('../common/app-props')
  const { createDb: createSqlite } = require('../lib/sqlite')
  const { dbAction: sqliteDbAction } = createSqlite(appPath, defaultUserName)
  const {
    checkDbUpgrade,
    doUpgrade
  } = require('./index')
  if (await checkDbUpgrade()) {
    await doUpgrade()
  }

  // Migrate data from each table
  for (const table of tables) {
    const nedbPath = reso(table)

    if (existsSync(nedbPath)) {
      log.info(`Migrating table: ${table}`)

      // Read all data from NeDB (unencrypted legacy data)
      const nedbData = await nedbDbAction(table, 'find', {})

      if (nedbData && nedbData.length > 0) {
        log.info(`Found ${nedbData.length} records in ${table}`)

        // Insert/update data into SQLite via db.js so enc/dec is applied
        for (const record of nedbData) {
          // Ensure record has an _id field
          const recordId = record._id || record.id
          if (!recordId) {
            log.warn(`Record in ${table} has no _id or id field, skipping:`, record)
            continue
          }
          // Use update with upsert option to handle existing records gracefully
          await sqliteDbAction(table, 'update',
            { _id: recordId },
            { $set: record },
            { upsert: true }
          )
        }

        log.info(`Successfully migrated ${nedbData.length} records from ${table}`)
      } else {
        log.info(`Table ${table} is empty, nothing to migrate`)
      }

      // Rename NeDB file to .bak
      const backupPath = nedbPath + '.bak'
      try {
        renameSync(nedbPath, backupPath)
        log.info(`Backed up ${nedbPath} to ${backupPath}`)
      } catch (renameError) {
        log.error(`Error backing up ${nedbPath}:`, renameError)
      }
    } else {
      log.info(`NeDB file for ${table} does not exist, skipping`)
    }
  }

  log.info('Migration from NeDB to SQLite completed successfully')
  return true
}

module.exports = {
  checkMigrate,
  migrate
}
