/**
 * load data from db
 */

import { dbNames, update, getData, fetchInitData, insert, remove } from '../common/db'
import initWatch from './watch'
import parseInt10 from '../common/parse-int10'
import { infoTabs, statusMap, defaultEnvLang, packInfo } from '../common/constants'
import fs from '../common/fs'
import generate from '../common/uid'
import defaultSettings from '../../app/common/default-setting'
import encodes from '../components/bookmark-form/encodes'
import runIdle from '../common/run-idle'
import track from '../common/track'

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
        port: port ? parseInt10(port) : 22
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
  if (options.port && parseInt10(options.port)) {
    update.port = parseInt10(options.port)
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
    const arr = store.config.onStartSessions || []
    for (const s of arr) {
      store.onSelectBookmark(s)
    }
    if (!arr.length) {
      store.initFirstTab()
    }

    const { initTime, loadTime } = window.pre.runSync('getLoadTime')
    if (loadTime) {
      store.loadTime = loadTime
    } else {
      const finishLoadTime = Date.now()
      store.loadTime = finishLoadTime - initTime
      window.pre.runSync('setLoadTime', store.loadTime)
    }
    track('app_open', {
      load_time: store.loadTime,
      bookmark_count: store.bookmarks.length,
      lang: store.config.language,
      sync_with_github: !!store.config.syncSetting.githubGistId,
      sync_with_gitee: !!store.config.syncSetting.giteeGistId,
      version: packInfo.version
    })
  }
  store.initData = async () => {
    const ext = {}
    const all = dbNames.map(async name => {
      const data = await fetchInitData(name)
      return {
        name,
        data
      }
    })
    await Promise.all(all)
      .then(arr => {
        for (const { name, data } of arr) {
          ext[name] = data
        }
      })
    ext.openedCategoryIds = await getData('openedCategoryIds') || ext.bookmarkGroups.map(b => b.id)
    ext.lastDataUpdateTime = await getData('lastDataUpdateTime') || 0
    ext.configLoaded = true
    Object.assign(store, ext)

    store.checkDefaultTheme()
    store.loadFontList()
    store.fetchItermThemes()
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
