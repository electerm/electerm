/**
 * common data upgrade process
 * It will check current version in db and check version in package.json,
 * run every upgrade script one by one
 */

const { packInfo } = require('../common/app-props')
const { version: packVersion } = packInfo
const { resolve } = require('path')
const fs = require('fs')
const log = require('../common/log')
const compare = require('../common/version-compare')
const { dbAction } = require('../lib/nedb')
const _ = require('lodash')
const initData = require('./init-nedb')
const { updateDBVersion } = require('./version-upgrade')
const emptyVersion = '0.0.0'
const versionQuery = {
  _id: 'version'
}

async function getDBVersion () {
  const version = await dbAction('data', 'findOne', versionQuery)
    .then(doc => {
      return doc ? doc.value : emptyVersion
    })
    .catch(e => {
      log.error(e)
      return emptyVersion
    })
  return version
}

/**
 * get upgrade versions should be run as version upgrade
 */
async function getUpgradeVersionList () {
  const version = await getDBVersion()
  const list = fs.readdirSync(__dirname)
  return list.filter(f => {
    const vv = f.replace('.js', '').replace('v', '')
    return /^v\d/.test(f) && compare(vv, version) > 0 && compare(vv, packVersion) <= 0
  }).sort((a, b) => {
    return compare(a, b)
  })
}
async function versionShouldUpgrade () {
  const dbVersion = await getDBVersion()
  log.info('database version:', dbVersion)
  return compare(dbVersion, packVersion) < 0
}

async function shouldUpgrade () {
  const shouldUpgradeVersion = await versionShouldUpgrade()
  if (!shouldUpgradeVersion) {
    return false
  }
  const dbVersion = await getDBVersion()
  log.info('dbVersion', dbVersion)
  if (dbVersion === emptyVersion) {
    await initData()
    await updateDBVersion(packVersion)
    return false
  }
  const list = await getUpgradeVersionList()
  if (_.isEmpty(list)) {
    await updateDBVersion(packVersion)
    return false
  }
  return {
    dbVersion,
    packVersion
  }
}

async function doUpgrade () {
  const list = await getUpgradeVersionList()
  log.info('Upgrading...')
  for (const v of list) {
    const p = resolve(__dirname, v)
    const run = require(p)
    await run()
  }
  log.info('Upgrade end')
}

exports.checkDbUpgrade = shouldUpgrade
exports.doUpgrade = doUpgrade
