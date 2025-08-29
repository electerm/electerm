/**
 * sqlite api wrapper
 */

const { appPath, defaultUserName } = require('../common/app-props')
const { resolve } = require('path')
const uid = require('../common/uid')
const { DatabaseSync } = require('node:sqlite')
const dbPath = resolve(appPath, 'electerm', 'users', defaultUserName, 'electerm.db')
const sqliteDb = new DatabaseSync(dbPath)
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
// const arrTables = new Set([
//   'bookmarks',
//   'terminalThemes',
//   'bookmarkGroups',
//   'quickCommands',
//   'addressBookmarks',
//   'profiles'
// ])

for (const table of tables) {
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS \`${table}\` (_id TEXT PRIMARY KEY, data TEXT)`)
}

function toDoc (row) {
  if (!row) return null
  return {
    ...JSON.parse(row.data || '{}'),
    _id: row._id
  }
}

function toRow (doc) {
  const _id = doc._id || doc.id || uid()
  const copy = { ...doc }
  delete copy._id
  delete copy.id
  return {
    _id,
    data: JSON.stringify(copy)
  }
}

async function dbActionRun (dbName, op, ...args) {
  if (op === 'compactDatafile') {
    return
  }
  if (!tables.includes(dbName)) {
    throw new Error(`Table ${dbName} does not exist`)
  }
  if (op === 'find') {
    const sql = `SELECT * FROM \`${dbName}\``
    const stmt = sqliteDb.prepare(sql)
    const rows = stmt.all()
    return (rows || []).map(toDoc).filter(Boolean)
  } else if (op === 'findOne') {
    const query = args[0] || {}
    const sql = `SELECT * FROM \`${dbName}\` WHERE _id = ? LIMIT 1`
    const params = [query._id]
    const stmt = sqliteDb.prepare(sql)
    const row = stmt.get(...params)
    return toDoc(row)
  } else if (op === 'insert') {
    const inserts = Array.isArray(args[0]) ? args[0] : [args[0]]
    const inserted = []
    for (const doc of inserts) {
      const { _id, data } = toRow(doc)
      const stmt = sqliteDb.prepare(`INSERT INTO \`${dbName}\` (_id, data) VALUES (?, ?)`)
      stmt.run(_id, data)
      inserted.push({ ...doc, _id })
    }
    return Array.isArray(args[0]) ? inserted : inserted[0]
  } else if (op === 'remove') {
    const query = args[0] || {}
    const sql = `DELETE FROM \`${dbName}\` WHERE _id = ?`
    const params = [query._id]
    const stmt = sqliteDb.prepare(sql)
    const res = stmt.run(...params)
    return res.changes
  } else if (op === 'update') {
    const query = args[0]
    const updateObj = args[1]
    const options = args[2] || {}
    const { upsert = false } = options
    const qid = query._id || query.id
    // const newData = updateObj.$set?.value || updateObj.$set || updateObj
    const isModifier = Object.keys(updateObj).some(k => k.startsWith('$'))
    if (isModifier) {
      if (!updateObj.$set) {
        throw new Error('Only $set modifier is supported')
      }
      const stmtGet = sqliteDb.prepare(`SELECT data FROM \`${dbName}\` WHERE _id = ?`)
      const currentRow = stmtGet.get(qid)
      if (!currentRow) {
        if (!upsert) {
          return 0
        }
        const newData = updateObj.$set
        const dataStr = JSON.stringify(newData)
        const stmtInsert = sqliteDb.prepare(`INSERT INTO \`${dbName}\` (_id, data) VALUES (?, ?)`)
        const res = stmtInsert.run(qid, dataStr)
        return res.changes
      }
      let setSql = 'data'
      const params = []
      for (const [key, value] of Object.entries(updateObj.$set)) {
        setSql = `json_set(${setSql}, '$.${key}', json(?))`
        params.push(JSON.stringify(value))
      }
      const sql = `UPDATE \`${dbName}\` SET data = ${setSql} WHERE _id = ?`
      params.push(qid)
      const stmtUpdate = sqliteDb.prepare(sql)
      const res = stmtUpdate.run(...params)
      return res.changes
    } else {
      const { _id, data } = toRow(updateObj)
      if (_id !== qid) {
        throw new Error('ID mismatch in update replacement')
      }
      let stmt
      if (upsert) {
        stmt = sqliteDb.prepare(`REPLACE INTO \`${dbName}\` (_id, data) VALUES (?, ?)`)
      } else {
        stmt = sqliteDb.prepare(`UPDATE \`${dbName}\` SET data = ? WHERE _id = ?`)
      }
      const res = stmt.run(data, qid)
      return res.changes
    }
  } else {
    throw new Error(`Unsupported operation: ${op}`)
  }
}

const dbAction = async (dbName, op, ...args) => {
  console.log('==================== dbAction START ====================')
  console.log('Parameters:')
  console.log('dbName:', dbName)
  console.log('op:', op)
  console.log('args:', args)
  const r = await dbActionRun(dbName, op, ...args)
  console.log('Result:', r)
  console.log('========================================================')

  return r
}

module.exports = {
  dbAction,
  tables
}
