/**
 * sync data to github gist related
 */

/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  settingMap
} from '../common/constants'
import { remove, dbNames, insert } from '../common/db'

const names = _.without(dbNames, settingMap.history)
const { getGlobal } = window
const Gist = window._require('gist-wrapper').default
const {
  version: packVer
} = getGlobal('packInfo')

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
    if (data.githubAccessToken) {
      data.githubAccessToken = window.getGlobal('encrypt')(
        data.githubAccessToken,
        data.gistId
      )
    }
    Object.assign(store.config.syncSetting, data)
    window.gitClient = new Gist(
      store.getGistToken()
    )
  }

  store.getGistToken = (
    syncSetting = store.config.syncSetting
  ) => {
    const token = _.get(syncSetting, 'githubAccessToken')
    const encrypted = _.get(syncSetting, 'encrypted')
    if (encrypted && token) {
      return window.getGlobal('decrypt')(
        token,
        _.get(syncSetting, 'gistId')
      )
    } else {
      return token
    }
  }

  store.getGistClient = (
    githubAccessToken = store.getGistToken()
  ) => {
    if (
      !window.gitClient ||
      githubAccessToken !== store.getGistToken()
    ) {
      window.gitClient = new Gist(githubAccessToken)
    }
    return window.gitClient
  }

  store.getGist = async (syncSetting = store.config.syncSetting || {}) => {
    const token = store.getGistToken(syncSetting)
    const client = store.getGistClient(token)
    if (!client.token) {
      return
    }
    const gist = await client.getOne(syncSetting.gistId).catch(
      log.error
    )
    return gist
  }

  store.uploadSetting = async (syncSetting = store.config.syncSetting || {}) => {
    const token = store.getGistToken(syncSetting)
    const client = store.getGistClient(token)
    if (!client.token) {
      return
    }
    store.isSyncingSetting = true
    store.isSyncUpload = true
    const objs = names.reduce((p, n) => {
      return {
        ...p,
        [`${n}.json`]: {
          content: JSON.stringify(copy(store[n]))
        }
      }
    })
    const res = await client.update(syncSetting.gistId, {
      description: 'sync electerm data',
      files: {
        objs,
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
    }).catch(store.onError)
    store.isSyncingSetting = false
    store.isSyncUpload = false
    if (res) {
      store.config.syncSetting.lastSyncTime = Date.now()
    }
  }

  store.downloadSetting = async (syncSetting = store.config.syncSetting || {}) => {
    store.isSyncingSetting = true
    store.isSyncDownload = true
    let gist = await store.getGist(syncSetting)
      .catch(store.onError)
    store.isSyncingSetting = false
    store.isSyncDownload = false
    if (!gist) {
      return
    }
    gist = gist.data
    const toInsert = []
    const ext = names.reduce((p, n) => {
      const arr = JSON.parse(
        _.get(gist, `files["${n}.json"].content`)
      )
      toInsert.push({
        name: n,
        value: arr
      })
      return {
        ...p,
        [n]: arr
      }
    }, {})
    const userConfig = JSON.parse(
      _.get(gist, 'files["userConfig.json"].content')
    )
    Object.assign(store, ext)
    store.setTheme(userConfig.theme)
    store.config.syncSetting.lastSyncTime = Date.now()
    for (const u of toInsert) {
      await remove(u.name)
      await insert(u.name, u.value)
    }
  }

  store.syncSetting = async (syncSetting = store.config.syncSetting || {}) => {
    let gist = await store.getGist(syncSetting)
    if (!gist) {
      return
    }
    gist = gist.data
    if (!gist.files['electerm-status.json']) {
      return
    }
    const status = JSON.parse(gist.files['electerm-status.json'].content)
    if (status.lastSyncTime > syncSetting.lastUpdateTime) {
      store.uploadSetting()
    } else if (status.lastSyncTime < syncSetting.lastUpdateTime) {
      store.downloadSetting()
    }
  }

  store.updateSyncTime = () => {
    store.updateSyncSetting({
      lastUpdateTime: Date.now()
    })
  }

  store.checkSettingSync = () => {
    store.updateSyncTime()
    if (_.get(store, 'config.syncSetting.autoSync')) {
      store.uploadSetting()
    }
  }

  store.getSerials = async () => {
    store.loaddingSerials = true
    const res = await window._require('serialport').list()
      .catch(store.onError)
    if (res) {
      store.serials = res
    }
    store.loaddingSerials = false
  }
}
