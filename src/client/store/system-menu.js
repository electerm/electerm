/**
 * system menu functions
 */

import Modal from '../components/common/modal'
import { isString } from 'lodash-es'
import getInitItem from '../common/init-setting-item'
import { refs } from '../components/common/ref'
import {
  settingMap,
  maxZoom,
  minZoom
} from '../common/constants'

const e = window.translate

/**
 * Detect whether the WebGL renderer's internal devicePixelRatio is stale
 * after a zoom factor change. On some platforms (e.g., AltLinux), xterm's
 * ScreenDprMonitor does not fire after setZoomFactor, leaving the renderer
 * with stale cell dimensions and breaking copy/paste selection.
 *
 * Sets window.et.webglDprBroken to a tri-state value:
 *   undefined — not yet checked (first zoom)
 *   true      — platform is affected, WebGL renderer needs reload after zoom
 *   false     — platform is fine, skip detection on subsequent zooms
 */
function detectWebglDprIssue () {
  if (window.et.webglDprBroken !== undefined) {
    return
  }
  setTimeout(() => {
    const termRef = refs.get('term-' + window.store.activeTabId)
    const canvas = termRef?.term?.element?.querySelector('canvas')
    if (!canvas || !canvas.width) {
      return
    }
    const cssWidth = canvas.getBoundingClientRect().width
    if (!cssWidth) {
      return
    }
    const canvasDpr = canvas.width / cssWidth
    const windowDpr = window.devicePixelRatio
    window.et.webglDprBroken = Math.abs(canvasDpr - windowDpr) > 0.01
  }, 300)
}

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
    detectWebglDprIssue()
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

  Store.prototype.onNewSshAI = function () {
    const { store } = window
    if (store.aiConfigMissing()) {
      store.toggleAIConfig()
      return
    }
    window.et.openBookmarkWithAIMode = true
    store.onNewSsh()
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
