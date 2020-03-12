/**
 * upgrade database to v1.2.0
 * migrate old file based db to nedb
 */

const { resolve } = require('path')
const { dbAction, tables } = require('../lib/nedb')
const { appPath, defaultUserName } = require('../utils/app-props')
const userConfigPath = resolve(appPath, 'electerm-user-config.json')
const savePath = resolve(appPath, 'electerm-localstorage.json')
const { existsSync, unlinkSync, writeFileSync } = require('fs')
const log = require('../utils/log')
const _ = require('lodash')
const { userConfigId } = require('../common/constants')

async function loadArr (arr, name) {
  await dbAction(name, 'insert', arr.map(d => {
    const { id, ...rest } = d
    return {
      _id: id,
      ...rest
    }
  }))
  await dbAction('data', 'insert', {
    _id: `${name}:order`,
    value: arr.map(d => d.id)
  })
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
    if (shouldLoadAsArray(k, v)) {
      await loadArr(v, k)
    } else {
      await dbAction('data', 'insert', {
        _id: k,
        value: v
      })
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
  await dbAction('data', 'insert', {
    _id: userConfigId,
    value: uf
  })
  log.log('End migrating user config')
}

module.exports = async () => {
  log.info('Start: upgrading to v1.3.0')
  await migrateData()
  await migrateUserConfig()
  log.info('Done: upgrading to v1.3.0')
}
