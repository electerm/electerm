/**
 * system menu functions
 */

import { Modal } from 'antd'
import _ from 'lodash'
import openInfoModal from '../components/sidebar/info-modal'
import getInitItem from '../common/init-setting-item'
import {
  settingMap,
  maxZoom,
  minZoom
} from '../common/constants'

const { prefix } = window
const m = prefix('menu')
const c = prefix('common')

export default store => {
  Object.assign(store, {
    openMenu () {
      store.menuOpened = true
    },

    closeMenu () {
      store.menuOpened = false
    },

    onCloseMenu () {
      const dom = document.getElementById('outside-context')
      dom && dom.removeEventListener('click', store.closeContextMenu)
    },
    zoom (level = 1, plus = false, zoomOnly) {
      const { webFrame } = require('electron')
      let nl = plus
        ? webFrame.getZoomFactor() + level
        : level
      if (nl > maxZoom) {
        nl = maxZoom
      } else if (nl < minZoom) {
        nl = minZoom
      }
      webFrame.setZoomFactor(nl)
      if (zoomOnly) {
        return
      }
      store.config.zoom = nl
    },

    onCloseAbout (cb) {
      if (_.isFunction(cb)) {
        cb()
      }
      store.focus()
    },

    openAbout () {
      openInfoModal({
        onCheckUpdating: store.upgradeInfo.checkingRemoteVersion || store.upgradeInfo.upgrading,
        onCheckUpdate: store.onCheckUpdate,
        onCancel: store.onCloseAbout,
        onOk: store.focus
      })
    },
    initMenuEvent () {
      const dom = document.getElementById('outside-context')
      dom && dom.addEventListener('click', store.closeMenu)
    },

    onNewSsh () {
      store.storeAssign({
        tab: settingMap.bookmarks,
        settingItem: getInitItem([], settingMap.bookmarks),
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    confirmExit (type) {
      let mod = null
      mod = Modal.confirm({
        onCancel: () => mod.destroy(),
        onOk: store[type],
        title: m('quit'),
        okText: c('ok'),
        cancelText: c('cancel'),
        content: ''
      })
    },

    exit () {
      if (store.isTransporting) {
        store.confirmExit('doExit')
      } else {
        store.doExit()
      }
    },

    restart () {
      if (store.isTransporting) {
        store.confirmExit('doRestart')
      } else {
        store.doRestart()
      }
    },

    doExit () {
      window.getGlobal('closeApp')()
    },

    doRestart () {
      window.getGlobal('restart')()
    }
  })
}
