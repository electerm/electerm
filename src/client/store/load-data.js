/**
 * load data from db
 */

import { dbNames, update, getData, fetchInitData, insert, remove } from '../common/db'
import initWatch from './watch'
import { infoTabs, statusMap, defaultEnvLang } from '../common/constants'
import fs from '../common/fs'
import generate from '../common/uid'
import defaultSettings from '../../app/common/default-setting'
import encodes from '../components/bookmark-form/encodes'
import runIdle from '../common/run-idle'

function getHost (argv, opts) {
  const arr = argv
  let i = arr.length - 1
  const reg = /^(?:([\w\d-_]+)@)?([\w\d-_]+\.[\w\d-_.]+)(?::([\d]+))?$/
  for (; i >= 0; i--) {
    const str = arr[i]
    const mt = str.match(reg)
    if (mt) {
      const port = mt[3]
      const user = mt[1]
      return {
        host: mt[2],
        username: user,
        port: port ? parseInt(port, 10) : 22
      }
    }
  }
  return {}
}

export async function addTabFromCommandLine (store, opts) {
  log.debug('command line params', opts)
  if (!opts) {
    return false
  }
  const {
    isHelp,
    helpInfo,
    options,
    argv
  } = opts
  store.commandLineHelp = helpInfo
  if (isHelp) {
    return store.openAbout(infoTabs.cmd)
  }
  const conf = getHost(argv, options)
  const update = {
    passphrase: options.passphrase,
    password: options.password,
    // port: options.port ? parseInt(options.port, 10) : 22,
    type: 'remote',
    status: statusMap.processing,
    id: generate(),
    encode: encodes[0],
    enableSftp: true,
    envLang: defaultEnvLang,
    term: defaultSettings.terminalType
  }
  if (options.title) {
    update.title = options.title
  }
  if (options.user) {
    update.username = options.user
  }
  if (options.port && parseInt(options.port, 10)) {
    update.port = parseInt(options.port, 10)
  }
  Object.assign(conf, update)
  if (options.privateKeyPath) {
    conf.privateKey = await fs.readFile(options.privateKeyPath)
  }
  log.debug('command line opts', conf)
  if (conf.username && conf.host) {
    store.addTab(conf)
  }
}

export default (store) => {
  store.batchDbUpdate = async (updates) => {
    runIdle(() => {
      for (const u of updates) {
        update(u.id, u.update, u.db, u.upsert)
      }
    })
  }
  store.batchDbAdd = async (adds) => {
    runIdle(() => {
      for (const u of adds) {
        insert(u.db, u.obj)
      }
    })
  }
  store.batchDbDel = async (dels) => {
    runIdle(() => {
      for (const u of dels) {
        remove(u.db, u.id)
      }
    })
  }
  store.openInitSessions = () => {
    for (const s of store.config.onStartSessions || []) {
      store.onSelectBookmark(s)
    }
    store.initFirstTab()
  }
  store.initData = async () => {
    store.isSencondInstance = window.pre.runSync('isSencondInstance')
    console.log('isSencondInstance', store.isSencondInstance)
    await store.checkForDbUpgrade()
    const ext = {}
    for (const name of dbNames) {
      ext[name] = await fetchInitData(name)
    }
    ext.openedCategoryIds = await getData('openedCategoryIds') || ext.bookmarkGroups.map(b => b.id)
    ext.lastDataUpdateTime = await getData('lastDataUpdateTime') || 0
    ext.configLoaded = true
    Object.assign(store, ext)

    await store.checkDefaultTheme()
    await store.initShortcuts()
    await store.loadFontList()
    store.openInitSessions()
    initWatch(store)
    store.initCommandLine().catch(store.onError)
  }
  store.initCommandLine = async () => {
    const opts = await window.pre.runGlobalAsync('initCommandLine')
    addTabFromCommandLine(store, opts)
  }
  store.addTabFromCommandLine = (event, opts) => {
    addTabFromCommandLine(store, opts)
  }
}
