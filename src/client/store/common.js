/**
 * common functions
 */

import handleError from '../common/error-handler'
import Modal from '../components/common/modal'
import { debounce, some, get, pickBy } from 'lodash-es'
import {
  leftSidebarWidthKey,
  rightSidebarWidthKey,
  addPanelWidthLsKey,
  dismissDelKeyTipLsKey,
  connectionMap,
  lastAiChatSessionIdKey,
  mobileBreakpoint,
  splitMap
} from '../common/constants'
import * as ls from '../common/safe-local-storage'
import { refs, refsStatic } from '../components/common/ref'
import { action } from 'manate'
import uid from '../common/uid'
import deepCopy from 'json-deep-copy'
import { aiConfigsArr } from '../components/ai/ai-config-props'

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
    window.store.showAIConfigModal = true
  }

  Store.prototype.onResize = debounce(async function () {
    const { width, height } = await window.pre.runGlobalAsync('getScreenSize')
    const isMaximized = window.pre.runSync('isMaximized')
    const w = window.innerWidth
    const isMobile = w <= mobileBreakpoint
    const update = {
      height: window.innerHeight,
      innerWidth: w,
      screenWidth: width,
      screenHeight: height,
      isMaximized,
      isMobile
    }
    window.store.storeAssign(update)
    // Force single-column layout on mobile
    if (isMobile && window.store.layout !== splitMap.c1) {
      window.store.setLayout(splitMap.c1)
    }
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

  Store.prototype.setAddPanelWidth = function (v) {
    ls.setItem(addPanelWidthLsKey, v)
    window.store.addPanelWidth = v
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
      const filtered = pickBy(p.rdp, (value) => value !== undefined && value !== '')
      return {
        ...tab,
        ...filtered
      }
    } else if (type === connectionMap.vnc) {
      const filtered = pickBy(p.vnc, (value) => value !== undefined && value !== '')
      return {
        ...tab,
        ...filtered
      }
    } else if (type === connectionMap.telnet) {
      const filtered = pickBy(p.telnet, (value) => value !== undefined && value !== '')
      return {
        ...tab,
        ...filtered
      }
    }
    delete p.rdp
    delete p.vnc
    delete p.telnet
    const filtered = pickBy(p, (value) => value !== undefined && value !== '')
    return {
      ...tab,
      ...filtered
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

  Store.prototype.startNewChat = action(function () {
    const { store } = window
    store.currentChatSessionId = uid()
    store.showChatSessions = false
    window.localStorage.setItem(lastAiChatSessionIdKey, store.currentChatSessionId)
  })

  Store.prototype.loadChatSession = action(function (sessionId) {
    const { store } = window
    store.currentChatSessionId = sessionId
    store.showChatSessions = false
    window.localStorage.setItem(lastAiChatSessionIdKey, sessionId)
  })

  Store.prototype.deleteChatSession = action(function (sessionId) {
    const { store } = window
    const remaining = store.aiChatHistory.filter(d => d.chatSessionId !== sessionId)
    store.aiChatHistory = remaining
    if (store.currentChatSessionId === sessionId) {
      store.startNewChat()
    }
  })

  Store.prototype.clearAllChatSessions = action(function () {
    const { store } = window
    store.aiChatHistory = []
    store.showChatSessions = false
    store.startNewChat()
  })

  Store.prototype.compressChatSession = async function (sessionId) {
    const { store } = window
    const sessionEntries = store.aiChatHistory
      .filter(h => h.chatSessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp)

    // Find the last compress entry
    let lastCompressIndex = -1
    for (let i = sessionEntries.length - 1; i >= 0; i--) {
      if (sessionEntries[i].compressed) {
        lastCompressIndex = i
        break
      }
    }

    // Need at least 2 non-compress entries since the last compress
    const entriesAfterCompress = lastCompressIndex >= 0
      ? sessionEntries.slice(lastCompressIndex + 1)
      : sessionEntries
    if (entriesAfterCompress.length < 2) {
      return
    }

    const firstEntry = sessionEntries[0]
    const lang = firstEntry.languageAI || store.getLangName()
    const messages = [
      { role: 'system', content: firstEntry.roleAI + `;用[${lang}]回复` }
    ]

    // Start from the last compress entry to include its summary as context
    const startIndex = lastCompressIndex >= 0 ? lastCompressIndex : 0
    for (let i = startIndex; i < sessionEntries.length; i++) {
      const entry = sessionEntries[i]
      if (entry.compressed) {
        messages.push({
          role: 'user',
          content: `Here is a summary of our previous conversation for context:\n\n${entry.response}`
        })
        messages.push({
          role: 'assistant',
          content: 'Understood. I will use this context as we continue.'
        })
      } else {
        messages.push({ role: 'user', content: entry.prompt })
        if (entry.response) {
          messages.push({ role: 'assistant', content: entry.response })
        }
      }
    }

    const summaryPrompt = 'Please summarize the above conversation concisely. Include key information, decisions, context, and any important details that would be needed to continue this conversation effectively.'
    messages.push({ role: 'user', content: summaryPrompt })

    const aiResponse = await window.pre.runGlobalAsync(
      'AIchat',
      summaryPrompt,
      firstEntry.modelAI,
      firstEntry.roleAI,
      firstEntry.baseURLAI,
      firstEntry.apiPathAI,
      firstEntry.apiKeyAI,
      firstEntry.proxyAI,
      false,
      firstEntry.authHeaderNameAI,
      messages
    )

    if (aiResponse && aiResponse.error) {
      return store.onError(new Error(aiResponse.error))
    }

    const summary = aiResponse.response || ''
    const compressedEntry = {
      id: uid(),
      prompt: '*Compressed session summary*',
      response: summary,
      isStreaming: false,
      pending: false,
      sessionId: null,
      chatSessionId: sessionId,
      mode: firstEntry.mode,
      toolCalls: [],
      nameAI: firstEntry.nameAI,
      modelAI: firstEntry.modelAI,
      roleAI: firstEntry.roleAI,
      baseURLAI: firstEntry.baseURLAI,
      apiPathAI: firstEntry.apiPathAI,
      apiKeyAI: firstEntry.apiKeyAI,
      proxyAI: firstEntry.proxyAI,
      languageAI: firstEntry.languageAI,
      authHeaderNameAI: firstEntry.authHeaderNameAI,
      timestamp: Date.now(),
      compressed: true
    }

    // Append compress entry, preserve existing history
    store.aiChatHistory.push(compressedEntry)
  }

  Store.prototype.toggleChatSessions = action(function () {
    const { store } = window
    store.showChatSessions = !store.showChatSessions
  })

  Store.prototype.getChatSessions = function () {
    const { aiChatHistory } = window.store
    const sessionMap = new Map()
    for (const entry of aiChatHistory) {
      const sid = entry.chatSessionId
      if (!sid) continue
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          sessionId: sid,
          firstPrompt: entry.prompt || '',
          timestamp: entry.timestamp,
          messageCount: 1,
          entries: [entry]
        })
      } else {
        const session = sessionMap.get(sid)
        session.messageCount++
        session.entries.push(entry)
        if (entry.timestamp > session.timestamp) {
          session.timestamp = entry.timestamp
        }
      }
    }
    return Array.from(sessionMap.values()).sort((a, b) => b.timestamp - a.timestamp)
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

  Store.prototype.makeSureProfileDefault = function (defaultId) {
    const { profiles } = window.store
    for (const p of profiles) {
      if (p.id !== defaultId) {
        delete p.isDefault
      }
    }
  }

  Store.prototype.aiConfigMissing = function () {
    return aiConfigsArr.filter(k => k !== 'apiKeyAI' && k !== 'proxyAI' && k !== 'nameAI').some(k => !window.store.config[k])
  }

  Store.prototype.clearHistory = function () {
    window.store.history = []
  }

  Store.prototype.addCmdHistory = action(function (cmd) {
    if (!cmd || !cmd.trim()) {
      return
    }
    const { terminalCommandHistory } = window.store
    const existing = terminalCommandHistory.find(item => item.cmd === cmd)
    if (existing) {
      existing.count = existing.count + 1
      existing.lastUseTime = new Date().toISOString()
    } else {
      terminalCommandHistory.push({
        id: uid(),
        cmd,
        count: 1,
        lastUseTime: new Date().toISOString()
      })
    }
    if (terminalCommandHistory.length > 200) {
      // Delete oldest 20 items when history exceeds 100
      terminalCommandHistory.sort((a, b) => new Date(a.lastUseTime).getTime() - new Date(b.lastUseTime).getTime())
      terminalCommandHistory.splice(0, 20)
    }
  })

  Store.prototype.deleteCmdHistory = function (cmd) {
    const { terminalCommandHistory } = window.store
    const idx = terminalCommandHistory.findIndex(item => item.cmd === cmd)
    if (idx !== -1) {
      terminalCommandHistory.splice(idx, 1)
    }
  }

  Store.prototype.clearAllCmdHistory = function () {
    window.store.terminalCommandHistory = []
  }

  Store.prototype.runCmdFromHistory = function (cmd) {
    window.store.runQuickCommand(cmd)
    window.store.addCmdHistory(cmd)
  }
}
