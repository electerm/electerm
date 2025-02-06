/**
 * common functions
 */

import handleError from '../common/error-handler'
import { Modal } from 'antd'
import { debounce, some, get } from 'lodash-es'
import {
  modals,
  leftSidebarWidthKey,
  rightSidebarWidthKey,
  dismissDelKeyTipLsKey,
  connectionMap
} from '../common/constants'
import * as ls from '../common/safe-local-storage'
import { refs, refsStatic } from '../components/common/ref'
import { action } from 'manate'
import deepCopy from 'json-deep-copy'

const e = window.translate
const { assign } = Object

export default Store => {
  Store.prototype.storeAssign = function (updates) {
    assign(window.store, updates)
  }

  Store.prototype.onError = function (e) {
    handleError(e)
  }

  Store.prototype.updateConfig = function (ext) {
    window.store.setConfig(ext)
  }

  Store.prototype.openInfoPanel = action(function () {
    const { store } = window
    store.rightPanelVisible = true
    store.rightPanelTab = 'info'
    store.openInfoPanelAction()
  })

  Store.prototype.openInfoPanelAction = function () {
    const { store } = window
    setTimeout(() => {
      const term = refs.get('term-' + store.activeTabId)
      term && term.handleShowInfo()
    }, 300)
  }

  Store.prototype.toggleAIConfig = function () {
    window.store.showAIConfig = !window.store.showAIConfig
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
      refsStatic.get('batch-op')?.setState({
        text
      })
    }
    function queue () {
      refsStatic.get('batch-op')?.handleClick()
    }
    function run () {
      refsStatic.get('batch-op')?.handleExec()
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
    window.store.settingItem = v
  }

  Store.prototype.setTermSearchOption = function (update) {
    Object.assign(window.store._termSearchOptions, update)
  }

  Store.prototype.setLeftSidePanelWidth = function (v) {
    ls.setItem(leftSidebarWidthKey, v)
    window.store.leftSidebarWidth = v
  }

  Store.prototype.setRightSidePanelWidth = function (v) {
    ls.setItem(rightSidebarWidthKey, v)
    window.store.rightPanelWidth = v
  }
  Store.prototype.dismissDelKeyTip = function (v) {
    ls.setItem(dismissDelKeyTipLsKey, 'y')
    window.store.hideDelKeyTip = true
  }
  Store.prototype.beforeExit = function (evt) {
    const { confirmBeforeExit } = window.store.config
    if (
      (confirmBeforeExit &&
      !window.confirmExit) ||
      window.store.isTransporting
    ) {
      evt.returnValue = false
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
        title: e('quit'),
        okText: e('ok'),
        cancelText: e('cancel'),
        content: ''
      })
    }
  }
  Store.prototype.beforeExitApp = function (evt, name) {
    let mod = null
    mod = Modal.confirm({
      onCancel: () => {
        window.pre.runGlobalAsync('setCloseAction', 'closeApp')
        mod.destroy()
      },
      onOk: () => {
        window.pre.runGlobalAsync(name)
      },
      title: e('quit'),
      okText: e('ok'),
      cancelText: e('cancel'),
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
      profile,
      type,
      authType
    } = tab
    if (!profile || authType !== 'profiles') {
      return tab
    }
    let p = window.store.profiles.find(x => x.id === profile)
    if (!p) {
      return tab
    }
    p = deepCopy(p)
    // delete tab.password
    // delete tab.privateKey
    // delete tab.passphrase
    delete p.name
    delete p.id
    if (type === connectionMap.rdp) {
      return {
        ...tab,
        ...p.rdp
      }
    } else if (type === connectionMap.vnc) {
      return {
        ...tab,
        ...p.vnc
      }
    } else if (type === connectionMap.telnet) {
      return {
        ...tab,
        ...p.telnet
      }
    }
    delete p.rdp
    delete p.vnc
    delete p.telnet
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

  Store.prototype.handleOpenAIPanel = function () {
    const { store } = window
    store.rightPanelVisible = true
    store.rightPanelTab = 'ai'
  }

  Store.prototype.explainWithAi = function (txt) {
    const { store } = window
    store.handleOpenAIPanel()
    setTimeout(() => {
      refsStatic.get('AIChat')?.setPrompt(`explain terminal output: ${txt}`)
    }, 500)
    setTimeout(() => {
      refsStatic.get('AIChat')?.handleSubmit()
    }, 1200)
  }

  Store.prototype.runCommandInTerminal = function (cmd) {
    window.store.batchInputSelectedTabIds.forEach(id => {
      refs.get('term-' + id)?.runQuickCommand(cmd)
    })
  }

  Store.prototype.removeAiHistory = function (id) {
    const { store } = window
    const index = store.aiChatHistory.findIndex(d => d.id === id)
    if (index === -1) {
      return
    }
    window.store.aiChatHistory.splice(index, 1)
  }

  Store.prototype.getLangName = function (
    lang = window.store?.config.language || 'en_us'
  ) {
    return get(window.langMap, `[${lang}].name`)
  }

  Store.prototype.getLangNames = function () {
    return window.et.langs.map(d => d.name)
  }

  Store.prototype.fixProfiles = function () {
    const { profiles } = window.store
    const len = profiles.length
    let i = len - 1
    for (;i >= 0; i--) {
      const f = profiles[i]
      if (f.name) {
        continue
      }
      let count = 0
      let id = 'PROFILE' + i
      while (profiles.find(d => d.id === id)) {
        count = count + 1
        id = 'PROFILE' + count
      }
      const np = deepCopy(f)
      np.id = id
      np.name = id
      profiles.splice(i, 1, np)
    }
  }
}
