/**
 * common functions
 */

import handleError from '../common/error-handler'
import _ from 'lodash'
import postMessage from '../common/post-msg'
import {
  commonActions,
  tabActions,
  modals
} from '../common/constants'

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

  Store.prototype.onResize = _.debounce(async function () {
    const { width, height } = await window.pre.runGlobalAsync('getScreenSize')
    const isMaximized = await window.pre.runGlobalAsync('isMaximized')
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
    function updateText () {
      const text = window.pre.readFileSync(path).toString()
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
}
