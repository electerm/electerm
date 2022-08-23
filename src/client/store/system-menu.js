/**
 * system menu functions
 */

import { Modal } from 'antd'
import _ from 'lodash'
import getInitItem from '../common/init-setting-item'
import {
  settingMap,
  maxZoom,
  minZoom
} from '../common/constants'

const { prefix } = window
const m = prefix('menu')
const c = prefix('common')

export default Store => {
  Store.prototype.zoom = function (level = 1, plus = false, zoomOnly) {
    let nl = plus
      ? window.pre.getZoomFactor() + level
      : level
    if (nl > maxZoom) {
      nl = maxZoom
    } else if (nl < minZoom) {
      nl = minZoom
    }
    window.pre.setZoomFactor(nl)
    if (zoomOnly) {
      return
    }
    window.store.config.zoom = nl
  }

  Store.prototype.onCloseAbout = function (cb) {
    const { store } = window
    store.showInfoModal = false
    if (_.isFunction(cb)) {
      cb()
    }
    store.focus()
  }

  Store.prototype.openAbout = function (tab) {
    const { store } = window
    store.showInfoModal = true
    if (_.isString(tab)) {
      store.infoModalTab = tab
    }
  }

  Store.prototype.onNewSsh = function () {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.bookmarks,
      settingItem: getInitItem([], settingMap.bookmarks),
      autofocustrigger: +new Date()
    })
    store.openModal()
  }

  Store.prototype.onNewWindow = async function () {
    window.pre.runGlobalAsync('openNewInstance')
  }

  Store.prototype.confirmExit = function (type) {
    const { store } = window
    let mod = null
    mod = Modal.confirm({
      onCancel: () => mod.destroy(),
      onOk: store.doExit,
      title: m('quit'),
      okText: c('ok'),
      cancelText: c('cancel'),
      content: ''
    })
  }

  Store.prototype.exit = function () {
    const { store } = window
    if (
      !store.isTransporting &&
      !store.config.confirmBeforeExit
    ) {
      return store.doExit()
    }
    store.confirmExit()
  }

  Store.prototype.restart = function () {
    const { store } = window
    if (store.isTransporting) {
      store.confirmExit('doRestart')
    } else {
      store.doRestart()
    }
  }

  Store.prototype.doExit = function () {
    window.pre.runGlobalAsync('closeApp')
  }

  Store.prototype.doRestart = function () {
    window.pre.runGlobalAsync('restart')
  }
}
