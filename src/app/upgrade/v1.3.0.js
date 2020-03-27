/**
 * upgrade database to v1.3.0
 * migrate old file based db to nedb
 */

const { resolve } = require('path')
const { dbAction, tables } = require('../lib/nedb')
const { appPath } = require('../utils/app-props')
const userConfigPath = resolve(appPath, 'electerm-user-config.json')
const savePath = resolve(appPath, 'electerm-localstorage.json')
const { existsSync, unlinkSync, writeFileSync } = require('fs')
const log = require('../utils/log')
const _ = require('lodash')
const { userConfigId } = require('../common/constants')
const { updateDBVersion } = require('./version-upgrade')

async function loadArr (arr, name) {
  await dbAction(name, 'insert', arr.map(d => {
    const { id, ...rest } = d
    return {
      _id: id,
      ...rest
    }
  })).catch(log.error)
}

function shouldLoadAsArray (key, value) {
  return tables.includes(key) && _.isArray(value) && value.length && value[0].id
}

async function migrateData () {
  const exist = existsSync(savePath)
  if (!exist) {
    return false
  }
  log.log('Start migrating data')
  let json = {}
  try {
    json = require(savePath)
  } catch (e) {
    log.error(e)
    log.error('load json data fails')
  }
  const keys = Object.keys(json)
  for (const k of keys) {
    const v = json[k]
    const _id = k.startsWith('laststate')
      ? k.split('.')[1]
      : k
    const db = k.startsWith('laststate')
      ? 'lastStates'
      : 'data'
    if (k === 'themes') {
      const vs = Object.values(v)
      for (const vv of vs) {
        const { id, ...rest } = vv
        await dbAction('terminalThemes', 'insert', {
          _id: id,
          ...rest
        }).catch(log.error)
      }
    } else if (shouldLoadAsArray(k, v)) {
      await loadArr(v, k)
    } else {
      await dbAction(db, 'insert', {
        _id,
        value: v
      }).catch(log.error)
    }
  }
  await writeFileSync(savePath + '.backup', JSON.stringify(json))
  await unlinkSync(savePath)
  log.log('Finish migrating data')
}

async function migrateUserConfig () {
  const exist = existsSync(userConfigPath)
  if (!exist) {
    return false
  }
  log.log('Start migrating user config')
  let uf = {}
  try {
    uf = require(userConfigPath)
  } catch (e) {
    log.error(e)
    log.error('load user config fails')
  }
  await dbAction('data', 'update', {
    _id: userConfigId
  }, {
    _id: userConfigId,
    value: uf
  }, {
    upsert: true
  }).catch(log.error)
  log.log('End migrating user config')
}

module.exports = async () => {
  const versionTo = '1.3.0'
  log.info(`Start: upgrading to v${versionTo}`)
  await migrateData()
  await migrateUserConfig()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
