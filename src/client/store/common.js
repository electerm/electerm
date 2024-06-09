/**
 * common functions
 */

import handleError from '../common/error-handler'
import { Modal } from 'antd'
import { debounce, some } from 'lodash-es'
import postMessage from '../common/post-msg'
import {
  commonActions,
  tabActions,
  modals,
  leftSidebarWidthKey,
  rightSidebarWidthKey,
  dismissDelKeyTipLsKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'

const { prefix } = window
const m = prefix('menu')
const c = prefix('common')

export default Store => {
  Store.prototype.storeAssign = function (updates) {
    Object.assign(this, updates)
  }

  Store.prototype.setOffline = function () {
    postMessage({
      action: tabActions.setAllTabOffline
    })
  }

  Store.prototype.onError = function (e) {
    handleError(e)
  }

  Store.prototype.updateConfig = function (ext) {
    window.store.setConfig(ext)
  }

  Store.prototype.openFileInfoModal = function (data) {
    postMessage({
      data,
      action: commonActions.showFileInfoModal
    })
  }

  Store.prototype.openFileModeModal = function (data, file) {
    postMessage({
      data,
      file,
      action: commonActions.showFileModeModal
    })
  }

  Store.prototype.onResize = debounce(async function () {
    const { width, height } = await window.pre.runGlobalAsync('getScreenSize')
    const isMaximized = window.pre.runSync('isMaximized')
    const update = {
      height: window.innerHeight,
      innerWidth: window.innerWidth,
      screenWidth: width,
      screenHeight: height,
      isMaximized
    }
    window.store.storeAssign(update)
    window.pre.runGlobalAsync('setWindowSize', {
      ...update,
      height: window.outerHeight
    })
  }, 100, {
    leading: true
  })

  Store.prototype.toggleTerminalSearch = function () {
    const now = Date.now()
    if (window.lastToggleTerminalSearch && now - window.lastToggleTerminalSearch < 300) {
      return
    }
    window.lastToggleTerminalSearch = now
    window.store.termSearchOpen = !window.store.termSearchOpen
  }

  Store.prototype.setState = function (name, value) {
    window.store['_' + name] = JSON.stringify(value)
  }

  Store.prototype.toggleBatchOp = function () {
    window.store.showModal = window.store.showModal === modals.batchOps ? modals.hide : modals.batchOps
  }

  Store.prototype.runBatchOp = function (path) {
    window.store.showModal = modals.batchOps
    async function updateText () {
      const text = await window.fs.readFile(path)
      postMessage({
        action: commonActions.batchOp,
        batchOp: {
          func: 'setState',
          args: [
            {
              text
            }
          ]
        }
      })
    }
    function queue () {
      postMessage({
        action: commonActions.batchOp,
        batchOp: {
          func: 'handleClick',
          args: []
        }
      })
    }
    function run () {
      postMessage({
        action: commonActions.batchOp,
        batchOp: {
          func: 'handleExec',
          args: []
        }
      })
    }
    try {
      setTimeout(updateText, 2000)
      setTimeout(queue, 3000)
      setTimeout(run, 4000)
    } catch (e) {
      log.error(e)
    }
  }

  Store.prototype.setSettingItem = function (v) {
    window.store.setState('settingItem', v)
  }

  Store.prototype.setTermSearchOption = function (update) {
    const {
      store
    } = window
    store.setState('termSearchOptions', {
      ...JSON.parse(window.store._termSearchOptions),
      ...update
    })
  }

  Store.prototype.setLeftSidePanelWidth = function (v) {
    ls.setItem(leftSidebarWidthKey, v)
    window.store.leftSidebarWidth = v
  }

  Store.prototype.setRightSidePanelWidth = function (v) {
    ls.setItem(rightSidebarWidthKey, v)
    window.store.rightSidebarWidth = v
  }
  Store.prototype.dismissDelKeyTip = function (v) {
    ls.setItem(dismissDelKeyTipLsKey, 'y')
    window.store.hideDelKeyTip = true
  }
  Store.prototype.beforeExit = function (e) {
    const { confirmBeforeExit } = window.store.config
    if (
      (confirmBeforeExit &&
      !window.confirmExit) ||
      window.store.isTransporting
    ) {
      e.returnValue = false
      let mod = null
      mod = Modal.confirm({
        onCancel: () => {
          window.confirmExit = false
          mod.destroy()
        },
        onOk: () => {
          window.confirmExit = true
          window.store[window.exitFunction]()
        },
        title: m('quit'),
        okText: c('ok'),
        cancelText: c('cancel'),
        content: ''
      })
    }
  }
  Store.prototype.beforeExitApp = function (e, name) {
    let mod = null
    mod = Modal.confirm({
      onCancel: () => {
        window.pre.runGlobalAsync('setCloseAction', 'closeApp')
        mod.destroy()
      },
      onOk: () => {
        window.pre.runGlobalAsync(name)
      },
      title: m('quit'),
      okText: c('ok'),
      cancelText: c('cancel'),
      content: ''
    })
  }

  Store.prototype.toggleResolutionEdit = function () {
    window.store.openResolutionEdit = !window.store.openResolutionEdit
  }

  Store.prototype.setTerminalInfos = function (arr) {
    window.store.setConfig({
      terminalInfos: arr
    })
  }

  Store.prototype.applyProfile = function (tab) {
    const {
      authType,
      profile
    } = tab
    if (authType !== 'profiles') {
      return tab
    }
    const p = window.store.profiles.find(x => x.id === profile)
    if (!p) {
      return tab
    }
    // delete tab.password
    // delete tab.privateKey
    // delete tab.passphrase
    delete p.name
    delete p.id
    return {
      ...tab,
      ...p
    }
  }
  Store.prototype.applyProfileToTabs = function (tab) {
    if (
      tab.connectionHoppings &&
      tab.connectionHoppings.length &&
      some(tab.connectionHoppings, s => s.profile)
    ) {
      tab.connectionHoppings = tab.connectionHoppings.map(s => {
        return window.store.applyProfile(s)
      })
    }
    return window.store.applyProfile(tab)
  }
}
