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
const { dbAction } = require('../lib/db')
const _ = require('../lib/lodash.js')
const initData = require('./init-db')
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
 * Seed the default data of a db that has never been initialised.
 *
 * Memoized on purpose: the startup read (ipc loadInitData) and the renderer's
 * checkDbUpgrade ask for it at the same moment on a brand new profile. Two
 * concurrent runs would both see `0.0.0` and insert the defaults twice, so
 * they share one promise instead.
 *
 * @returns {Promise<boolean>} true when this call seeded the db
 */
let ensureDbInitPromise
function ensureDbInit () {
  if (!ensureDbInitPromise) {
    ensureDbInitPromise = seedIfEmpty().catch(e => {
      // A db init failure must not take the startup read down with it: an
      // empty store is the state the app already knows how to run in.
      log.error('init db fails', e)
      return false
    })
  }
  return ensureDbInitPromise
}

async function seedIfEmpty () {
  const dbVersion = await getDBVersion()
  log.info('database version:', dbVersion)
  if (dbVersion !== emptyVersion) {
    return false
  }
  await initData()
  await updateDBVersion(packVersion)
  return true
}

/**
 * get upgrade versions should be run as version upgrade
 */
function parseUpgradeFile (f) {
  const m = /^v(\d+\.\d+\.\d+)\.js$/.exec(f)
  return m ? m[1] : null
}

async function getUpgradeVersionList () {
  const version = await getDBVersion()
  let list = []
  try {
    list = fs.readdirSync(__dirname)
  } catch (e) {
    log.error('read upgrade dir fails', e)
    return []
  }
  return list.filter(f => {
    const vv = parseUpgradeFile(f)
    return vv && compare(vv, version) > 0 && compare(vv, packVersion) <= 0
  }).sort((a, b) => {
    return compare(parseUpgradeFile(a), parseUpgradeFile(b))
  })
}

async function shouldUpgrade () {
  // A db that was never initialised is not an upgrade: seed it here, then let
  // the caller carry on with complete data. Idempotent through ensureDbInit,
  // so a startup read racing this call cannot seed twice.
  if (await ensureDbInit()) {
    return false
  }
  const dbVersion = await getDBVersion()
  if (compare(dbVersion, packVersion) >= 0) {
    return false
  }
  log.info('dbVersion', dbVersion)
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
    try {
      const run = require(p)
      await run()
    } catch (e) {
      // A single broken migration script must never brick app startup:
      // log it, stamp its version so it is not retried forever, continue
      log.error(`Upgrade script ${v} fails, skip it`, e)
      const vv = parseUpgradeFile(v)
      if (vv) {
        await updateDBVersion(vv)
      }
    }
  }
  log.info('Upgrade end')
}

exports.checkDbUpgrade = shouldUpgrade
exports.ensureDbInit = ensureDbInit
exports.doUpgrade = doUpgrade
exports.parseUpgradeFile = parseUpgradeFile
exports.getUpgradeVersionList = getUpgradeVersionList
