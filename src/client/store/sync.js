/**
 * sync data to github gist related
 */

import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  settingMap, packInfo, syncTypes
} from '../common/constants'
import { remove, dbNames, insert, update } from '../common/db'
import fetch from '../common/fetch-from-server'
import download from '../common/download'
import dayjs from 'dayjs'

const names = _.without(dbNames, settingMap.history)
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
    if (type === syncTypes.custom) {
      return ['AccessToken', 'ApiUrl', 'GistId'].map(
        p => {
          return _.get(window.store.config, 'syncSetting.' + type + p)
        }
      ).join('####')
    }
    return _.get(window.store.config, 'syncSetting.' + type + 'AccessToken')
  }

  Store.prototype.getSyncPassword = function (type) {
    return _.get(window.store.config, 'syncSetting.' + type + 'SyncPassword')
  }

  Store.prototype.getSyncGistId = function (type) {
    return _.get(window.store.config, 'syncSetting.' + type + 'GistId')
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

  Store.prototype.clearSyncSetting = async function () {
    window.store.setConfig({
      syncSetting: {}
    })
  }

  Store.prototype.uploadSetting = async function (type) {
    const { store } = window
    store.isSyncingSetting = true
    store.isSyncUpload = true
    const token = store.getSyncToken(type)
    let gistId = store.getSyncGistId(type)
    if (!gistId) {
      await store.createGist(type)
      gistId = store.getSyncGistId(type)
    }
    if (!gistId) {
      return
    }
    const pass = store.getSyncPassword(type)
    const objs = {}
    for (const n of names) {
      let str = JSON.stringify(store.getItems(n))
      if (n === settingMap.bookmarks && pass) {
        str = await window.pre.runGlobalAsync('encryptAsync', str, pass)
      }
      objs[`${n}.json`] = {
        content: str
      }
    }
    const res = await fetchData(type, 'update', [gistId, {
      description: 'sync electerm data',
      files: {
        ...objs,
        'userConfig.json': {
          content: JSON.stringify(_.pick(store.config, ['theme']))
        },
        'electerm-status.json': {
          content: JSON.stringify({
            lastSyncTime: Date.now(),
            electermVersion: packVer
          })
        }
      }
    }], token, store.getProxySetting()).catch(store.onError)
    store.isSyncingSetting = false
    store.isSyncUpload = false
    if (res) {
      store.updateSyncSetting({
        [type + 'LastSyncTime']: Date.now()
      })
    }
  }

  Store.prototype.downloadSetting = async function (type) {
    const { store } = window
    store.isSyncingSetting = true
    store.isSyncDownload = true
    const token = store.getSyncToken(type)
    let gistId = store.getSyncGistId(type)
    if (!gistId) {
      await store.createGist(type)
      gistId = store.getSyncGistId(type)
    }
    if (!gistId) {
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
    const toInsert = []
    for (const n of names) {
      let str = _.get(gist, `files["${n}.json"].content`)
      if (!str) {
        store.isSyncingSetting = false
        store.isSyncDownload = false
        throw new Error(('Seems you have a empty gist, you can try use existing gist ID or upload first'))
      }
      if (!isJSON(str)) {
        str = await window.pre.runGlobalAsync('decryptAsync', str, pass)
      }
      let arr = JSON.parse(
        str
      )
      if (n === settingMap.terminalThemes) {
        arr = store.fixThemes(arr)
      }
      toInsert.push({
        name: n,
        value: arr
      })
      store.setItems(n, arr)
    }
    const userConfig = JSON.parse(
      _.get(gist, 'files["userConfig.json"].content')
    )
    store.setTheme(userConfig.theme)
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
    for (const u of toInsert) {
      await remove(u.name)
      await insert(u.name, u.value)
    }
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
  //   if (_.get(store, 'config.syncSetting.autoSync')) {
  //     store.uploadSetting()
  //   }
  // }
  Store.prototype.onChangeEncrypt = function (v) {
    window.store.updateSyncSetting({
      syncEncrypt: v
    })
  }

  Store.prototype.updateLastDataUpdateTime = _.debounce(function () {
    const { store } = window
    store.lastDataUpdateTime = +new Date()
    update('lastDataUpdateTime', store.lastDataUpdateTime)
  }, 1000)

  Store.prototype.exportAll = function () {
    const { store } = window
    const objs = {}
    for (const n of names) {
      objs[n] = store.getItems(n)
    }
    objs.config = _.pick(store.config, [
      'theme',
      'useSystemTitleBar',
      'defaultEditor',
      'checkUpdateOnStart',
      'confirmBeforeExit',
      'ctrlOrMetaOpenTerminalLink',
      'cursorStyle',
      'defaultEditor',
      'disableSshHistory',
      'disableTransferHistory',
      'enableGlobalProxy',
      'execLinux',
      'execLinuxArgs',
      'execMac',
      'execMacArgs',
      'execWindows',
      'execWindowsArgs',
      'fontFamily',
      'fontSize',
      'hotkey',
      'keepaliveCountMax',
      'keepaliveInterval',
      'language',
      'opacity',
      'pasteWhenContextMenu',
      'proxyIp',
      'proxyPassword',
      'proxyPort',
      'proxyType',
      'proxyUsername',
      'rendererType',
      'rightClickSelectsWord',
      'saveTerminalLogToFile',
      'scrollback',
      'sshReadyTimeout',
      'syncSetting',
      'terminalTimeout',
      'terminalType',
      'theme',
      'useSystemTitleBar',
      'zoom'
    ])
    const text = JSON.stringify(objs)
    const name = dayjs().format('YYYY-MM-DD-HH-mm-ss') + '-electerm-all-data.json'
    download(name, text)
  }

  Store.prototype.importAll = async function (file) {
    const txt = window.pre
      .readFileSync(file.path).toString()
    const { store } = window
    const objs = JSON.parse(txt)
    const toInsert = []
    for (const n of names) {
      let arr = objs[n]
      if (n === settingMap.terminalThemes) {
        arr = store.fixThemes(arr)
      }
      toInsert.push({
        name: n,
        value: arr
      })
      store.setItems(n, objs[n])
    }
    for (const u of toInsert) {
      await remove(u.name)
      await insert(u.name, u.value)
    }
    store.updateConfig(objs.config)
    store.setTheme(objs.config.theme)
  }
}
