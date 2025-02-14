/**
 * sync data to github gist related
 */

import { get, pick, debounce } from 'lodash-es'
import copy from 'json-deep-copy'
import {
  settingMap, packInfo, syncTypes, syncDataMaps
} from '../common/constants'
import { dbNames, update, getData } from '../common/db'
import fetch from '../common/fetch-from-server'
import download from '../common/download'
import { fixBookmarks } from '../common/db-fix'
import dayjs from 'dayjs'
import parseJsonSafe from '../common/parse-json-safe'

const {
  version: packVer
} = packInfo

function isJSON (str = '') {
  return str.startsWith('[')
}

async function fetchData (type, func, args, token, proxy) {
  const data = {
    type,
    action: 'sync',
    func,
    args,
    token,
    proxy
  }
  return fetch(data)
}

function updateSyncServerStatusFromGist (store, gist, type) {
  const status = parseJsonSafe(
    get(gist, 'files["electerm-status.json"].content')
  )
  store.syncServerStatus[type] = status
}

export default (Store) => {
  Store.prototype.updateSyncSetting = function (data) {
    const { store } = window
    const nd = Object.assign({}, copy(store.config.syncSetting), data)
    if (data.giteeGistId && !data.giteeSyncPassword) {
      delete nd.giteeSyncPassword
    }
    if (data.githubGistId && !data.githubSyncPassword) {
      delete nd.githubSyncPassword
    }
    store.setConfig({
      syncSetting: nd
    })
  }

  Store.prototype.getSyncToken = function (type) {
    if (type === syncTypes.custom || type === syncTypes.cloud) {
      const arr = ['AccessToken', 'ApiUrl']
      if (type === syncTypes.custom) {
        arr.push('GistId')
      }
      return arr.map(
        p => {
          return get(window.store.config, 'syncSetting.' + type + p)
        }
      ).join('####')
    }
    return get(window.store.config, 'syncSetting.' + type + 'AccessToken')
  }

  Store.prototype.getSyncPassword = function (type) {
    return get(window.store.config, 'syncSetting.' + type + 'SyncPassword')
  }

  Store.prototype.getSyncGistId = function (type) {
    return get(window.store.config, 'syncSetting.' + type + 'GistId')
  }

  Store.prototype.testSyncToken = async function (type) {
    const { store } = window
    store.isSyncingSetting = true
    const token = store.getSyncToken(type)
    const gist = await fetchData(
      type,
      'test',
      [],
      token,
      store.getProxySetting()
    ).catch(
      log.error
    )
    store.isSyncingSetting = false
    return !!gist
  }

  Store.prototype.createGist = async function (type) {
    const { store } = window
    store.isSyncingSetting = true
    const token = store.getSyncToken(type)
    const data = {
      description: 'sync electerm data',
      files: {
        'placeholder.js': {
          content: 'placeholder'
        }
      },
      public: false
    }
    const res = await fetchData(
      type, 'create', [data], token, store.getProxySetting()
    ).catch(
      store.onError
    )
    if (res && type !== syncTypes.custom) {
      store.updateSyncSetting({
        [type + 'GistId']: res.id,
        [type + 'Url']: res.html_url
      })
    }
    store.isSyncingSetting = false
  }

  Store.prototype.handleClearSyncSetting = async function () {
    const { store } = window
    const currentSyncType = store.syncType
    const currentSettings = store.config.syncSetting || {}
    // Create a new object without the current sync type's settings
    const updatedSettings = Object.keys(currentSettings).reduce((acc, key) => {
      if (!key.startsWith(currentSyncType)) {
        acc[key] = currentSettings[key]
      }
      return acc
    }, {})
    store.setConfig({
      syncSetting: updatedSettings
    })
  }

  Store.prototype.uploadSettingAll = async function () {
    const { store, onSyncAll, syncCount = 0 } = window
    const max = dbNames.length * 2
    if (syncCount < max) {
      window.syncCount = syncCount + 1
      return
    }
    if (onSyncAll) {
      return
    }
    window.onSyncAll = true
    const types = Object.keys(syncTypes)
    for (const type of types) {
      const gistId = store.getSyncGistId(type)
      if (gistId) {
        await store.uploadSetting(type)
      }
    }
    window.onSyncAll = false
  }

  Store.prototype.uploadSetting = async function (type) {
    if (window[type + 'IsSyncing']) {
      return false
    }
    window[type + 'IsSyncing'] = true
    const { store } = window
    store.isSyncingSetting = true
    store.isSyncUpload = true
    await store.uploadSettingAction(type).catch(store.onError)
    store.isSyncingSetting = false
    store.isSyncUpload = false
    window[type + 'IsSyncing'] = false
  }

  Store.prototype.previewServerData = async function (type) {
    const { store } = window
    const token = store.getSyncToken(type)
    const gistId = store.getSyncGistId(type)
    const gist = await fetchData(
      type,
      'getOne',
      [gistId],
      token,
      store.getProxySetting()
    )
    updateSyncServerStatusFromGist(store, gist, type)
  }

  Store.prototype.uploadSettingAction = async function (type) {
    const { store } = window
    const token = store.getSyncToken(type)
    let gistId = store.getSyncGistId(type)
    if (!gistId && type !== syncTypes.cloud && type !== syncTypes.custom) {
      await store.createGist(type)
      gistId = store.getSyncGistId(type)
    }
    if (!gistId && type !== syncTypes.custom && type !== syncTypes.cloud) {
      return
    }
    const pass = store.getSyncPassword(type)
    const objs = {}
    const { names, syncConfig } = store.getDataSyncNames()
    for (const n of names) {
      let str = store.getItems(n)
      const order = await getData(`${n}:order`)
      if (order && order.length) {
        str.sort((a, b) => {
          const ai = order.findIndex(r => r === a.id)
          const bi = order.findIndex(r => r === b.id)
          return ai - bi
        })
      }
      str = JSON.stringify(str)
      if (
        (n === settingMap.bookmarks || n === settingMap.profiles) &&
        pass
      ) {
        str = await window.pre.runGlobalAsync('encryptAsync', str, pass)
      }
      objs[`${n}.json`] = {
        content: str
      }
      objs[`${n}.order.json`] = {
        content: 'empty'
      }
      if (syncConfig) {
        objs['userConfig.json'] = {
          content: JSON.stringify(
            store.getSyncConfig()
          )
        }
      }
    }
    const now = Date.now()
    const status = {
      lastSyncTime: now,
      electermVersion: packVer,
      deviceName: window.pre.osInfo().find(r => r.k === 'hostname')?.v || 'unknown'
    }
    const gistData = {
      description: 'sync electerm data',
      files: {
        ...objs,
        'electerm-status.json': {
          content: JSON.stringify(status)
        }
      }
    }
    const res = await fetchData(
      type,
      'update',
      [gistId, gistData],
      token,
      store.getProxySetting()
    )
    if (res) {
      store.updateSyncSetting({
        [type + 'LastSyncTime']: now
      })
      updateSyncServerStatusFromGist(store, gistData, type)
    }
  }

  Store.prototype.downloadSetting = async function (type) {
    const { store } = window
    store.isSyncingSetting = true
    store.isSyncDownload = true
    await store.downloadSettingAction(type).catch(store.onError)
    store.isSyncingSetting = false
    store.isSyncDownload = false
  }

  Store.prototype.downloadSettingAction = async function (type) {
    const { store } = window
    const token = store.getSyncToken(type)
    let gistId = store.getSyncGistId(type)
    if (!gistId && type !== syncTypes.cloud && type !== syncTypes.custom) {
      await store.createGist(type)
      gistId = store.getSyncGistId(type)
    }
    if (!gistId && type !== syncTypes.custom && type !== syncTypes.cloud) {
      return
    }
    const pass = store.getSyncPassword(type)
    const gist = await fetchData(
      type,
      'getOne',
      [gistId],
      token,
      store.getProxySetting()
    )
    if (gist) {
      updateSyncServerStatusFromGist(store, gist, type)
    }
    const { names, syncConfig } = store.getDataSyncNames()
    for (const n of names) {
      let str = get(gist, `files["${n}.json"].content`)
      if (!str) {
        if (n === settingMap.bookmarks) {
          throw new Error(('Seems you have a empty gist, you can try use existing gist ID or upload first'))
        } else {
          continue
        }
      }
      if (!isJSON(str)) {
        str = await window.pre.runGlobalAsync('decryptAsync', str, pass)
      }
      let arr = JSON.parse(
        str
      )
      if (n === settingMap.terminalThemes) {
        arr = store.fixThemes(arr)
      } else if (n === settingMap.bookmarks) {
        arr = fixBookmarks(arr)
      }
      let strOrder = get(gist, `files["${n}.order.json"].content`)
      if (isJSON(strOrder)) {
        strOrder = JSON.parse(strOrder)
        arr.sort((a, b) => {
          const ai = strOrder.findIndex(r => r === a.id)
          const bi = strOrder.findIndex(r => r === b.id)
          return ai - bi
        })
      }
      store.setItems(n, arr)
    }
    if (syncConfig) {
      const userConfig = parseJsonSafe(
        get(gist, 'files["userConfig.json"].content')
      )
      if (userConfig) {
        store.setConfig(userConfig)
      }
      if (userConfig && userConfig.theme) {
        store.setTheme(userConfig.theme)
      }
    }

    const up = {
      [type + 'LastSyncTime']: Date.now()
    }
    if (type !== syncTypes.custom) {
      Object.assign(up, {
        [type + 'GistId']: gist.id,
        [type + 'Url']: gist.html_url
      })
    }
    if (pass) {
      up[type + 'SyncPassword'] = pass
    }
    store.updateSyncSetting(up)
    store.isSyncingSetting = false
    store.isSyncDownload = false
  }

  // store.syncSetting = async (syncSetting = store.config.syncSetting || {}) => {
  //   let gist = await store.getGist(syncSetting)
  //   if (!gist) {
  //     return
  //   }
  //   gist = gist.data
  //   if (!gist.files['electerm-status.json']) {
  //     return
  //   }
  //   const status = JSON.parse(gist.files['electerm-status.json'].content)
  //   if (status.lastSyncTime > store.lastUpdateTime) {
  //     store.uploadSetting()
  //   } else if (status.lastSyncTime < store.lastUpdateTime) {
  //     store.downloadSetting()
  //   }
  // }

  // store.checkSettingSync = () => {
  //   if (get(store, 'config.syncSetting.autoSync')) {
  //     store.uploadSetting()
  //   }
  // }
  Store.prototype.onChangeEncrypt = function (v) {
    window.store.updateSyncSetting({
      syncEncrypt: v
    })
  }

  Store.prototype.updateLastDataUpdateTime = debounce(function () {
    const { store } = window
    store.lastDataUpdateTime = Date.now()
    update('lastDataUpdateTime', store.lastDataUpdateTime)
  }, 1000)

  Store.prototype.handleExportAllData = async function () {
    const { store } = window
    const objs = {}
    const { names } = store.getDataSyncNames(true)
    for (const n of names) {
      objs[n] = store.getItems(n)
      const order = await getData(`${n}:order`)
      if (order && order.length) {
        objs[n].sort((a, b) => {
          const ai = order.findIndex(r => r === a.id)
          const bi = order.findIndex(r => r === b.id)
          return ai - bi
        })
      }
    }
    objs.config = store.config
    const text = JSON.stringify(objs)
    const name = dayjs().format('YYYY-MM-DD-HH-mm-ss') + '-electerm-all-data.json'
    download(name, text)
  }

  Store.prototype.importAll = async function (file) {
    const txt = await window.fs
      .readFile(file.path)
    const { store } = window
    const objs = JSON.parse(txt)
    const { names } = store.getDataSyncNames(true)
    for (const n of names) {
      let arr = objs[n]
      if (n === settingMap.terminalThemes) {
        arr = store.fixThemes(arr)
      } else if (n === settingMap.bookmarks) {
        arr = fixBookmarks(arr)
      }
      store.setItems(n, objs[n])
    }
    store.updateConfig(objs.config)
    store.setTheme(objs.config.theme)
  }

  Store.prototype.handleAutoSync = function (v) {
    const { store } = window
    store.setConfig({
      autoSync: v
    })
  }

  Store.prototype.toggleDataSyncSelected = function (key) {
    const { store } = window
    const {
      dataSyncSelected = 'all'
    } = store.config
    let arr = dataSyncSelected && dataSyncSelected !== 'all'
      ? dataSyncSelected.split(',')
      : Object.keys(syncDataMaps)
    if (arr.includes(key)) {
      arr = arr.filter(d => d !== key)
    } else {
      arr.push(key)
    }
    store.setConfig({
      dataSyncSelected: arr.join(',')
    })
  }
  Store.prototype.getDataSyncNames = function (all) {
    const { store } = window
    const {
      dataSyncSelected = 'all'
    } = store.config
    const syncAll = all || dataSyncSelected === 'all'
    const keys = syncAll
      ? Object.keys(syncDataMaps)
      : dataSyncSelected.split(',')
    const names = keys
      .filter(d => d !== 'settings')
      .map(d => syncDataMaps[d]).flat()
    const syncConfig = keys.includes('settings')
    return {
      names,
      syncConfig
    }
  }
  Store.prototype.getSyncConfig = function () {
    const { store } = window
    const configSyncKeys = [
      'keepaliveInterval',
      'rightClickSelectsWord',
      'pasteWhenContextMenu',
      'ctrlOrMetaOpenTerminalLink',
      'hotkey',
      'sshReadyTimeout',
      'scrollback',
      'fontSize',
      'execWindows',
      'execMac',
      'execLinux',
      'execWindowsArgs',
      'execMacArgs',
      'execLinuxArgs',
      'disableSshHistory',
      'disableTransferHistory',
      'terminalType',
      'keepaliveCountMax',
      'saveTerminalLogToFile',
      'checkUpdateOnStart',
      'cursorBlink',
      'cursorStyle',
      'terminalWordSeparator',
      'confirmBeforeExit',
      'autoRefreshWhenSwitchToSftp',
      'addTimeStampToTermLog',
      'showHiddenFilesOnSftpStart',
      'terminalInfos',
      'filePropsEnabled',
      'hideIP',
      'terminalTimeout',
      'theme',
      'language',
      'copyWhenSelect',
      'customCss',
      'dataSyncSelected',
      'baseURLAI',
      'modelAI',
      'roleAI'
    ]
    return pick(store.config, configSyncKeys)
  }
}
