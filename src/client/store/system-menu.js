/**
 * system menu functions
 */

import { Modal } from 'antd'
import { isString } from 'lodash-es'
import getInitItem from '../common/init-setting-item'
import {
  settingMap,
  maxZoom,
  minZoom
} from '../common/constants'

const e = window.translate

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
    window.store.updateConfig({
      zoom: nl
    })
  }

  Store.prototype.onZoomIn = function () {
    window.store.zoom(0.25, true)
  }

  Store.prototype.onZoomout = function () {
    window.store.zoom(-0.25, true)
  }

  Store.prototype.onZoomReset = function () {
    window.store.zoom()
  }

  Store.prototype.openAbout = function (tab) {
    const { store } = window
    store.showInfoModal = true
    if (isString(tab)) {
      store.infoModalTab = tab
    }
  }

  Store.prototype.onNewSsh = function () {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.bookmarks
    })
    store.setSettingItem(getInitItem([], settingMap.bookmarks))
    store.openSettingModal()
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
      title: e('quit'),
      okText: e('ok'),
      cancelText: e('cancel'),
      content: ''
    })
  }

  Store.prototype.exit = function () {
    window.exitFunction = 'doExit'
    window.store.doExit()
  }

  Store.prototype.restart = function () {
    window.exitFunction = 'doRestart'
    window.store.doRestart()
  }

  Store.prototype.doExit = function () {
    window.pre.runGlobalAsync('closeApp', 'exit')
  }

  Store.prototype.doRestart = function () {
    window.pre.runGlobalAsync('restart', 'restart')
  }
}
