/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import Subx from 'subx'
import { message, notification, Modal } from 'antd'
import newTerm from '../common/new-terminal'
import _ from 'lodash'
import { generate } from 'shortid'
import copy from 'json-deep-copy'
import wait from '../common/wait'
import openInfoModal from '../components/sidebar/info-modal'
import createTitlte from '../common/create-title'
import {
  maxHistory,
  settingMap,
  defaultookmarkGroupId,
  maxTransferHistory,
  sidebarWidth,
  statusMap,
  defaultTheme,
  terminalSshConfigType
} from '../common/constants'
import * as terminalThemes from '../common/terminal-theme'

const { buildNewTheme } = terminalThemes
const { getGlobal, _config } = window
const Gist = window._require('gist-wrapper').default
const {
  version: packVer
} = getGlobal('packInfo')
const ls = getGlobal('ls')
const { prefix } = window
const t = prefix('terminalThemes')
const e = prefix('control')
const m = prefix('menu')
const c = prefix('common')
const newQuickCommand = 'newQuickCommand'
const q = prefix('quickCommands')
const ss = prefix('settingSync')
const defaultStatus = statusMap.processing
const sessionsGlob = copy(ls.get('sessions'))
const sshConfigItems = copy(getGlobal('sshConfigItems'))
function getDefaultBookmarkGroups (bookmarks) {
  return [
    {
      title: t(defaultookmarkGroupId),
      id: defaultookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    }
  ]
}
const getInitItem = (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return { id: '', title: '' }
  } else if (tab === settingMap.setting) {
    return { id: '', title: e('common') }
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  } else if (tab === settingMap.quickCommands) {
    return {
      id: '',
      name: q(newQuickCommand)
    }
  }
}

const tabs = [newTerm()]
const bookmarks = copy(ls.get(settingMap.bookmarks) || [])
const bookmarkGroups = copy(
  ls.get(settingMap.bookmarkGroups) ||
  getDefaultBookmarkGroups(bookmarks)
)

const store = Subx.create({
  tabs,
  height: 500,
  width: window.innerWidth - sidebarWidth,
  currentTabId: tabs[0].id,
  history: copy(ls.get(settingMap.history) || []),
  quickCommands: copy(ls.get(settingMap.quickCommands) || []),
  quickCommandId: '',
  bookmarks,
  bookmarkGroups,
  setting: [
    {
      id: 'setting-sync',
      title: ss('settingSync')
    }
  ],
  sshConfigItems: copy(getGlobal('sshConfigItems')),
  isMaximized: window.getGlobal('isMaximized')(),
  config: copy(_config) || {},
  contextMenuProps: {},
  transferHistory: [],
  themes: terminalThemes.getThemes(),
  contextMenuVisible: false,
  fileInfoModalProps: {},
  fileModeModalProps: {},
  currentBookmarkGroupId: defaultookmarkGroupId,
  transferHistoryModalVisible: false,
  selectedSessions: [],
  sessionModalVisible: false,
  textEditorProps: {},
  settingItem: getInitItem([], settingMap.bookmarks),

  // for settings related
  tab: settingMap.bookmarks,
  autofocustrigger: +new Date(),
  bookmarkId: undefined,
  showModal: false,
  activeTerminalId: '',

  // setting sync related
  isSyncingSetting: false,
  isSyncUpload: false,
  isSyncDownload: false,

  // sidebar
  openedSideBar: '',
  openedCategoryIds: ls.get('openedCategoryIds') || bookmarkGroups.map(b => b.id),
  menuOpened: false,

  // update
  shouldCheckUpdate: 0,
  upgradeInfo: {},

  // serial list related
  serials: [],
  loaddingSerials: false,

  // computed
  getThemeConfig () {
    return (_.find(store.themes, d => d.id === store.config.theme) || {}).themeConfig || {}
  },

  get tabTitles () {
    return store.tabs.map(d => d.title).join('#')
  },

  get bookmarkGroupsTotal () {
    return store.sshConfigItems.length
      ? [
        ...store.bookmarkGroups,
        {
          title: terminalSshConfigType,
          id: terminalSshConfigType,
          bookmarkIds: sshConfigItems.map(d => d.id)
        }
      ]
      : store.bookmarkGroups
  },

  get currentTab () {
    const tabs = copy(store.tabs)
    return _.find(tabs, tab => {
      return tab.id === store.currentTabId
    })
  },

  get currentQuickCommands () {
    const { currentTab, quickCommands } = store
    const currentTabQuickCommands = _.get(
      currentTab, 'quickCommands'
    ) || []
    return [
      ...currentTabQuickCommands,
      ...copy(quickCommands)
    ]
  },

  // methods
  setState (update) {
    Object.assign(store, update)
  },

  focus () {
    window.postMessage({
      type: 'focus'
    }, '*')
  },

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

  checkDefaultTheme () {
    const currentTheme = terminalThemes.getCurrentTheme()
    if (
      currentTheme.id === defaultTheme.id &&
      !_.isEqual(currentTheme.themeConfig, defaultTheme.themeConfig)
    ) {
      store.editTheme(
        defaultTheme.id,
        {
          themeConfig: defaultTheme.themeConfig
        }
      )
      message.info(
        `${t('default')} ${t('themeConfig')} ${t('updated')}`
      )
    }
  },

  setOffline () {
    store.tabs = store.tabs
      .map(t => {
        return {
          ...t,
          status: t.host ? statusMap.error : t.status
        }
      })
  },

  initContextEvent () {
    const dom = document.getElementById('outside-context')
    dom && dom.addEventListener('click', store.closeContextMenu)
  },

  initMenuEvent () {
    const dom = document.getElementById('outside-context')
    dom && dom.addEventListener('click', store.closeMenu)
  },

  selectall () {
    document.activeElement &&
    document.activeElement.select &&
    document.activeElement.select()
    window.postMessage({
      event: 'selectall',
      id: store.activeTerminalId
    }, '*')
  },

  zoom (level = 1, plus = false, zoomOnly) {
    const { webFrame } = require('electron')
    const nl = plus
      ? webFrame.getZoomFactor() + level
      : level
    webFrame.setZoomFactor(nl)
    if (zoomOnly) {
      return
    }
    store.config.zoom = nl
  },

  checkLastSession () {
    const status = window.getGlobal('getExitStatus')()
    if (status === 'ok') {
      return
    }
    store.showLastSessions(sessionsGlob)
  },

  showLastSessions (sessions) {
    if (!sessions) {
      return
    }
    store.setState({
      selectedSessions: copy(sessions).map(s => ({
        id: s.id,
        tab: s,
        checked: true
      })),
      sessionModalVisible: true
    })
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

  openTransferHistory () {
    store.transferHistoryModalVisible = true
  },

  closeTransferHistory () {
    store.transferHistoryModalVisible = false
  },

  clearTransferHistory () {
    store.setState({
      transferHistory: [],
      transferHistoryModalVisible: false
    })
  },

  addTransferHistory (item) {
    const { transferHistory } = store
    transferHistory.unshift(item)
    store.transferHistory = transferHistory.slice(0, maxTransferHistory)
  },

  onCheckUpdate (noSkipVersion = false) {
    if (store.onCheckUpdating) {
      return
    }
    const prefix = noSkipVersion ? 'noSkipVersion' : ''
    store.shouldCheckUpdate = prefix + new Date()
  },

  openContextMenu (contextMenuProps) {
    store.setState({
      contextMenuProps,
      contextMenuVisible: true
    })
    store.initContextEvent()
  },

  closeContextMenu () {
    store.setState({
      contextMenuVisible: false
    })
    store.dom && store.dom.removeEventListener('click', store.closeContextMenu)
  },

  onError (e) {
    const { message = 'error', stack } = e
    log.error(e)
    const msg = (
      <div className='mw240 elli wordbreak' title={message}>
        {message}
      </div>
    )
    const description = (
      <div
        className='mw300 elli common-err-desc wordbreak'
      >
        {stack}
      </div>
    )
    notification.error({
      message: msg,
      description,
      duration: 55
    })
  },

  addItem (item, type) {
    let items = store[type]
    items.unshift(item)
    if (type === settingMap.history && items.length > maxHistory) {
      items = items.slice(0, maxHistory)
    }
  },

  editItem (id, update, type) {
    const items = store[type]
    const item = _.find(items, t => t.id === id)
    if (!item) {
      return
    }
    // let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    // items.splice(index, 1, item)
    // store[type] = items
  },

  delItem ({ id }, type) {
    store[type] = store[type].filter(t => {
      return t.id !== id
    })
  },

  addTab (tab = newTerm(), index = store.tabs.length) {
    store.currentTabId = tab.id
    store.tabs.splice(index, 0, tab)
  },

  editTab (id, update) {
    store.editItem(id, update, 'tabs')
  },

  delTab ({ id }) {
    const { currentTabId } = store
    if (currentTabId === id) {
      const next = tabs[0] || {}
      store.currentTabId = next.id
    }
    store.tabs = store.tabs.filter(t => {
      return t.id !== id
    })
  },

  addTheme (theme) {
    store.themes.unshift(theme)
  },

  editTheme (id, update) {
    const items = store.themes
    const item = _.find(items, t => t.id === id)
    Object.assign(item, update)
  },

  delTheme ({ id }) {
    store.themes = store.themes.filter(t => {
      return t.id !== id
    })
    const { theme } = store.config
    if (theme === id) {
      store.config.theme = terminalThemes.defaultTheme.id
    }
  },

  addBookmarkGroup (group) {
    store.bookmarkGroups.push(group)
  },

  editBookmarkGroup (id, update) {
    const items = store.bookmarkGroups
    const item = _.find(items, t => t.id === id)
    Object.assign(item, update)
  },

  delBookmarkGroup ({ id }) {
    if (id === defaultookmarkGroupId) {
      return
    }
    let { bookmarkGroups } = store
    const tobeDel = _.find(bookmarkGroups, bg => bg.id === id)
    if (!tobeDel) {
      return
    }
    let groups = [tobeDel]
    if (
      tobeDel.level !== 2 &&
      tobeDel.bookmarkGroupIds &&
      tobeDel.bookmarkGroupIds.length > 0
    ) {
      const childs = bookmarkGroups.filter(
        bg => tobeDel.bookmarkGroupIds.includes(bg.id)
      )
      groups = [
        ...groups,
        ...childs
      ]
    }
    const groupIds = groups.map(g => g.id)
    const defaultCatIndex = tobeDel.level !== 2
      ? _.findIndex(
        bookmarkGroups,
        g => g.id === defaultookmarkGroupId
      )
      : _.findIndex(
        bookmarkGroups,
        g => (g.bookmarkGroupIds || []).includes(tobeDel.id)
      )
    for (const g of groups) {
      if (g.bookmarkIds.length) {
        const def = bookmarkGroups[defaultCatIndex]
        def.bookmarkIds = [
          ...g.bookmarkIds,
          ...def.bookmarkIds
        ]
      }
    }
    bookmarkGroups = bookmarkGroups.filter(t => {
      return !groupIds.includes(t.id)
    })
    store.bookmarkGroups = bookmarkGroups
    if (id === store.currentBookmarkGroupId) {
      store.currentBookmarkGroupId = ''
    }
  },

  setTheme (id) {
    store.config.theme = id
  },

  onDelItem (item, type) {
    if (item.id === store.settingItem.id) {
      store.settingItem = getInitItem(
        store[type],
        type
      )
    }
  },

  async reloadTab (tabToReload) {
    const tab = copy(
      tabToReload
    )
    const { id } = tab
    tab.id = generate()
    tab.status = statusMap.processing
    const tabs = store.tabs
    const index = _.findIndex(tabs, t => t.id === id)
    store.delTab({ id: tabToReload.id })
    await wait(30)
    store.addTab(tab, index)
  },

  onDuplicateTab (tab) {
    const index = _.findIndex(
      store.tabs,
      d => d.id === tab.id
    )
    store.addTab({
      ...tab,
      status: defaultStatus,
      id: generate(),
      isTransporting: undefined
    }, index + 1)
  },

  onChangeTabId (currentTabId) {
    store.currentTabId = currentTabId
  },

  onNewSsh () {
    store.setState({
      tab: settingMap.bookmarks,
      settingItem: getInitItem([], settingMap.bookmarks),
      autofocustrigger: +new Date()
    })
    store.openModal()
  },

  onEditHistory () {
    store.setState({
      tab: settingMap.history,
      settingItem: store.history[0] || getInitItem([], settingMap.history),
      autofocustrigger: +new Date()
    })
    store.openModal()
  },

  openQuickCommandsSetting () {
    store.setState({
      tab: settingMap.quickCommands,
      settingItem: getInitItem([], settingMap.quickCommands),
      autofocustrigger: +new Date()
    })
    store.openModal()
  },

  onSelectHistory (id) {
    const item = _.find(store.history, it => it.id === id)
    store.addTab({
      ...copy(item),
      from: 'history',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
  },

  onSelectBookmark (id) {
    const { history, bookmarks } = store
    const item = copy(
      _.find(bookmarks, it => it.id === id) ||
      _.find(sshConfigItems, it => it.id === id)
    )
    if (!item) {
      return
    }
    store.addTab({
      ...item,
      from: 'bookmarks',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
    item.id = generate()
    if (store.config.disableSshHistory) {
      return
    }
    const existItem = _.find(history, j => {
      const keysj = Object.keys(j)
      const keysi = Object.keys(item)
      return _.isEqual(
        _.pick(item, _.without(keysi, 'id')),
        _.pick(j, _.without(keysj, 'id'))
      )
    })
    if (!existItem) {
      store.addItem(item, settingMap.history)
    } else {
      const index = _.findIndex(history, f => f.id === existItem.id)
      history.splice(index, 1)
      history.unshift(existItem)
    }
  },

  openSetting () {
    store.setState({
      tab: settingMap.setting,
      settingItem: getInitItem([], settingMap.setting)
    })
    store.openModal()
  },

  openSettingSync () {
    store.setState({
      tab: settingMap.setting,
      settingItem: store.setting[0]
    })
    store.openModal()
  },

  openTerminalThemes () {
    store.setState({
      tab: settingMap.terminalThemes,
      settingItem: buildNewTheme(),
      autofocustrigger: +new Date()
    })
    store.openModal()
  },

  openModal () {
    store.showModal = true
  },

  hideModal () {
    store.showModal = false
    store.focus()
  },

  getItems (tab, props = store) {
    return tab === settingMap.terminalThemes
      ? copy(props.themes)
      : copy(props[tab]) || []
  },

  onChangeTab (tab) {
    const arr = store.getItems(tab)
    const item = getInitItem(arr, tab)
    store.setState({
      settingItem: item,
      autofocustrigger: +new Date(),
      tab
    })
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
  },

  get isTransporting () {
    return store.tabs.some(t => t.isTransporting)
  },

  get list () {
    const {
      tab
    } = store
    const arr = store.getItems(tab)
    const initItem = getInitItem(arr, tab)
    return tab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
  },

  updateSyncSetting (data) {
    const keys = Object.keys(data)
    if (_.isEqual(
      _.pick(store.config.syncSetting, keys),
      data
    )) {
      return
    }
    Object.assign(store.config.syncSetting, data)
    window.gitClient = new Gist(store.config.syncSetting.githubAccessToken)
  },

  getGistClient (
    githubAccessToken = _.get(store, 'config.syncSetting.githubAccessToken')
  ) {
    if (
      !window.gitClient ||
      githubAccessToken !== _.get(store, 'config.syncSetting.githubAccessToken')
    ) {
      window.gitClient = new Gist(githubAccessToken)
    }
    return window.gitClient
  },

  async getGist (syncSetting = store.config.syncSetting || {}) {
    const client = store.getGistClient(syncSetting.githubAccessToken)
    if (!client.token) {
      return
    }
    const gist = await client.getOne(syncSetting.gistId).catch(
      console.log
    )
    return gist
  },

  async uploadSetting (syncSetting = store.config.syncSetting || {}) {
    const client = store.getGistClient(syncSetting.githubAccessToken)
    if (!client.token) {
      return
    }
    store.isSyncingSetting = true
    store.isSyncUpload = true
    const res = await client.update(syncSetting.gistId, {
      description: 'sync electerm data',
      files: {
        'bookmarks.json': {
          content: JSON.stringify(copy(store.bookmarks))
        },
        'bookmarkGroups.json': {
          content: JSON.stringify(copy(store.bookmarkGroups))
        },
        'terminalThemes.json': {
          content: JSON.stringify(copy(store.themes))
        },
        'quickCommands.json': {
          content: JSON.stringify(copy(store.quickCommands))
        },
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
  },

  async downloadSetting (syncSetting = store.config.syncSetting || {}) {
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
    const bookmarks = JSON.parse(
      _.get(gist, 'files["bookmarks.json"].content')
    )
    const bookmarkGroups = JSON.parse(
      _.get(gist, 'files["bookmarkGroups.json"].content')
    )
    const terminalThemes = JSON.parse(
      _.get(gist, 'files["terminalThemes.json"].content')
    )
    const quickCommands = JSON.parse(
      _.get(gist, 'files["quickCommands.json"].content')
    )
    const userConfig = JSON.parse(
      _.get(gist, 'files["userConfig.json"].content')
    )
    Object.assign(store, {
      bookmarks,
      bookmarkGroups,
      themes: terminalThemes,
      quickCommands
    })
    store.setTheme(userConfig.theme)
    store.config.syncSetting.lastSyncTime = Date.now()
  },

  async syncSetting (syncSetting = store.config.syncSetting || {}) {
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
  },

  updateSyncTime () {
    store.updateSyncSetting({
      lastUpdateTime: Date.now()
    })
  },

  checkSettingSync () {
    store.updateSyncTime()
    if (_.get(store, 'config.syncSetting.autoSync')) {
      store.uploadSetting()
    }
  },

  async getSerials () {
    store.loaddingSerials = true
    const res = await window._require('serialport').list()
      .catch(store.onError)
    if (res) {
      store.serials = res
    }
    store.loaddingSerials = false
  }

})

store.clickNextTab = _.debounce(() => {
  const tab = document.querySelector('.tabs-wrapper .tab.active')
  if (tab) {
    let next = tab.nextSibling
    if (!next || !next.classList.contains('tab')) {
      next = document.querySelector('.tabs-wrapper .tab')
    }
    next &&
    next.querySelector('.tab-title') &&
    next.querySelector('.tab-title').click()
  }
}, 100)

store.onResize = _.debounce(() => {
  const update = {
    height: window.innerHeight,
    width: window.innerWidth - sidebarWidth,
    isMaximized: window.getGlobal('isMaximized')()
  }
  store.setState(update)
  window
    .getGlobal('lastStateManager')
    .set('windowSize', update)
}, 100)

// auto focus when tab change
Subx.autoRun(store, () => {
  store.focus()
  const { currentTabId } = store
  const tab = _.find(tabs, t => t.id === currentTabId) || {}
  const title = createTitlte(tab)
  window.getGlobal('setTitle')(title)
  return store.currentTabId
})

Subx.autoRun(store, () => {
  if (store.menuOpened) {
    store.initMenuEvent()
  } else {
    store.onCloseMenu()
  }
  return store.menuOpened
})

Subx.autoRun(store, () => {
  ls.set('sessions', copy(store.tabs).map(t => {
    delete t.isTransporting
    return t
  }))
  return store.tabs
})

Subx.autoRun(store, () => {
  ls.set('bookmarks', store.bookmarks)
  return store.bookmarks
})

Subx.autoRun(store, () => {
  const themesObj = store.themes.reduce((p, k) => {
    return {
      ...p,
      [k.id]: k
    }
  }, {})
  ls.set('themes', themesObj)
  return store.themes
})

Subx.autoRun(store, () => {
  ls.set('quickCommands', store.quickCommands)
  return store.quickCommands
})

Subx.autoRun(store, () => {
  ls.set('history', store.history)
  return store.history
})

Subx.autoRun(store, () => {
  ls.set('openedCategoryIds', store.openedCategoryIds)
  return store.openedCategoryIds
})

Subx.autoRun(store, () => {
  ls.set('bookmarkGroups', store.bookmarkGroups)
  return store.bookmarkGroups
})

Subx.autoRun(store, () => {
  getGlobal('saveUserConfig')(store.config)
  return store.config
})

Subx.autoRun(store, () => {
  store.checkSettingSync()
  return [
    store.config.theme,
    store.terminalThemes,
    store.bookmarkGroups,
    store.quickCommands,
    store.bookmarks
  ]
})
store.modifier = store.setState

export default store
