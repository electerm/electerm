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
      store.config.zoom = nl
    },

    onCloseAbout (cb) {
      store.showInfoModal = false
      if (_.isFunction(cb)) {
        cb()
      }
      store.focus()
    },

    openAbout (tab) {
      store.showInfoModal = true
      if (_.isString(tab)) {
        store.infoModalTab = tab
      }
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
      window.pre.runGlobalAsync('closeApp')
    },

    doRestart () {
      window.pre.runGlobalAsync('restart')
    }
  })
}
