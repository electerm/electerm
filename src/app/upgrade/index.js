/**
 * common data upgrade process
 * It will check current version in db and check version in package.json,
 * run every upgrade script one by one
 */

const { packInfo } = require('../utils/app-props')
const { version: packVersion } = packInfo
const { resovle } = require('path')
const fs = require('fs')
const log = require('../utils/log')
const comapre = require('../common/version-compare')
const { dbAction } = require('../lib/nedb')
const _ = require('lodash')

let version
const versionQuery = {
  _id: 'version'
}

async function getDBVersion () {
  if (version) {
    return version
  }
  version = await dbAction('data', 'findOne', versionQuery)
    .then(doc => {
      return doc ? doc.version : null
    })
    .catch(e => {
      log.error(e)
      return null
    })
  if (!version) {
    version = '0.0.0'
  }
  return version
}

/**
 * get upgrade versions should be run as version upgrade
 */
async function getUpgradeVersionList () {
  let version = await getDBVersion()
  if (!version) {
    version = '0.0.0'
  }
  const list = fs.readdirSync(__dirname)
  return list.filter(f => {
    const vv = f.replace('.js', '').replace('v', '')
    return f.startsWith('v') && comapre(vv, version) > 0
  }).sort((a, b) => {
    return comapre(a, b)
  })
}
async function versionShouldUpgrade () {
  const dbVersion = await getDBVersion()
  return comapre(dbVersion, packVersion) < 0
}

async function shouldUpgrade () {
  const dbVersion = await getDBVersion()
  const shouldUpgradeVersion = await versionShouldUpgrade()
  if (!shouldUpgradeVersion) {
    return false
  }
  const list = await getUpgradeVersionList()
  if (_.isEmpty(list)) {
    await updateDBVersion()
    return false
  }
  return {
    dbVersion,
    packVersion
  }
}

async function updateDBVersion () {
  if (versionShouldUpgrade()) {
    await dbAction('data', 'update', versionQuery, {
      version: packVersion
    })
      .then(() => {
        version = packVersion
      })
      .catch(e => {
        log.error(e)
        log.error('upgrade db version error')
      })
  }
}

async function doUpgrade () {
  const list = getUpgradeVersionList()
  if (!list.length) {
    await updateDBVersion()
    return
  }
  log.info('Upgrading...')
  for (const v of list) {
    const p = resovle(__dirname, v)
    const run = require(p)
    await run()
  }
  await updateDBVersion()
  log.info('Upgrade end')
}

exports.checkDbUpgrade = shouldUpgrade
exports.doUpgrade = doUpgrade
