/**
 * sync data to github gist related
 */

/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  settingMap, packInfo
} from '../common/constants'
import { remove, dbNames, insert, update } from '../common/db'
import fetch from '../common/fetch-from-server'

const names = _.without(dbNames, settingMap.history)
const {
  version: packVer
} = packInfo

function isJSON (str = '') {
  return str.startsWith('[')
}

async function fetchData (type, func, args, token) {
  const data = {
    type,
    action: 'sync',
    func,
    args,
    token
  }
  return fetch(data)
}

export default (store) => {
  store.openSettingSync = () => {
    store.storeAssign({
      tab: settingMap.setting,
      settingItem: store.setting[0]
    })
    store.openModal()
  }

  store.updateSyncSetting = (_data) => {
    const data = copy(_data)
    const keys = Object.keys(data)
    if (_.isEqual(
      _.pick(store.config.syncSetting, keys),
      data
    )) {
      return
    }
    store.config = {
      ...copy(store.config),
      syncSetting: Object.assign({}, copy(store.config.syncSetting), data)
    }
  }

  store.getSyncToken = (type) => {
    return _.get(store.config, 'syncSetting.' + type + 'AccessToken')
  }

  store.getSyncGistId = (type) => {
    return _.get(store.config, 'syncSetting.' + type + 'GistId')
  }

  store.testSyncToken = async (type) => {
    store.isSyncingSetting = true
    const token = store.getSyncToken(type)
    const gist = await fetchData(
      type,
      'test',
      [],
      token
    ).catch(
      log.error
    )
    store.isSyncingSetting = false
    return !!gist
  }

  store.createGist = async (type) => {
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
      type, 'create', [data], token
    ).catch(
      store.onError
    )
    if (res) {
      store.updateSyncSetting({
        [type + 'GistId']: res.id,
        [type + 'Url']: res.html_url
      })
    }
    store.isSyncingSetting = false
  }

  store.uploadSetting = async (type) => {
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
    const objs = {}
    for (const n of names) {
      let str = JSON.stringify(copy(store[n]))
      if (n === settingMap.bookmarks && store.config.syncSetting.syncEncrypt) {
        str = await window.pre.runGlobalAsync('encryptAsync', str, token)
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
    }], token).catch(store.onError)
    store.isSyncingSetting = false
    store.isSyncUpload = false
    if (res) {
      store.updateSyncSetting({
        [type + 'LastSyncTime']: Date.now()
      })
    }
  }

  store.downloadSetting = async (type) => {
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
    const gist = await fetchData(
      type,
      'getOne',
      [gistId],
      token
    )
    const toInsert = []
    const ext = {}
    for (const n of names) {
      let str = _.get(gist, `files["${n}.json"].content`)
      if (!str) {
        store.isSyncingSetting = false
        store.isSyncDownload = false
        throw new Error(('Seems you have a empty gist, you can try use existing gist ID or upload first'))
      }
      if (!isJSON(str)) {
        str = await window.pre.runGlobalAsync('decryptAsync', str, token)
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
      ext[n] = arr
    }
    const userConfig = JSON.parse(
      _.get(gist, 'files["userConfig.json"].content')
    )
    Object.assign(store, ext)
    store.setTheme(userConfig.theme)
    store.updateSyncSetting({
      [type + 'GistId']: gist.id,
      [type + 'Url']: gist.html_url,
      [type + 'LastSyncTime']: Date.now()
    })
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
  store.onChangeEncrypt = v => {
    store.updateSyncSetting({
      syncEncrypt: v
    })
  }

  store.updateLastDataUpdateTime = _.debounce(() => {
    store.lastDataUpdateTime = +new Date()
    update('lastDataUpdateTime', store.lastDataUpdateTime)
  }, 1000)
}
