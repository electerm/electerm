/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import Subx from 'subx'
import { message, notification } from 'antd'
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
  defaultTheme
} from '../common/constants'
import * as terminalThemes from '../common/terminal-theme'

const { buildNewTheme } = terminalThemes
const { getGlobal, _config } = window
const ls = getGlobal('ls')
const { prefix } = window
const t = prefix('terminalThemes')
const e = prefix('control')
const defaultStatus = statusMap.processing
let sessionsGlob = copy(ls.get('sessions'))
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
  }
}

let tabs = [newTerm()]
let bookmarks = copy(ls.get(settingMap.bookmarks) || [])
let bookmarkGroups = copy(
  ls.get(settingMap.bookmarkGroups) ||
  getDefaultBookmarkGroups(bookmarks)
)

const store = Subx.create({
  tabs,
  height: 500,
  width: window.innerWidth - sidebarWidth,
  currentTabId: tabs[0].id,
  history: copy(ls.get(settingMap.history) || []),
  bookmarks,
  bookmarkGroups,
  sshConfigItems: copy(getGlobal('sshConfigItems')),
  isMaximized: window.getGlobal('isMaximized')(),
  config: copy(_config) || {},
  contextMenuProps: {},
  transferHistory: [],
  themes: terminalThemes.getThemes(),
  theme: terminalThemes.getCurrentTheme().id,
  contextMenuVisible: false,
  fileInfoModalProps: {},
  fileModeModalProps: {},
  currentBookmarkGroupId: defaultookmarkGroupId,
  transferHistoryModalVisible: false,
  selectedSessions: [],
  sessionModalVisible: false,
  textEditorProps: {},
  item: getInitItem([], settingMap.bookmarks),

  // for settings related
  tab: settingMap.bookmarks,
  autofocustrigger: +new Date(),
  bookmarkId: undefined,
  showModal: false,
  activeTerminalId: '',

  // sidebar
  openedSideBar: '',
  openedCategoryIds: ls.get('openedCategoryIds') || bookmarkGroups.map(b => b.id),
  menuOpened: false,

  // update
  shouldCheckUpdate: 0,
  upgradeInfo: {},

  // computed
  getThemeConfig () {
    return (_.find(store.themes, d => d.id === store.theme) || {}).themeConfig || {}
  },

  get tabTitles () {
    return store.tabs.map(d => d.title).join('#')
  },

  get bookmarkGroupsTotal () {
    return store.sshConfigItems.length
      ? [
        ...store.bookmarkGroups,
        {
          title: 'ssh-config',
          id: 'ssh-config',
          bookmarkIds: sshConfigItems.map(d => d.id)
        }
      ]
      : store.bookmarkGroups
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
    let dom = document.getElementById('outside-context')
    dom && dom.removeEventListener('click', this.closeContextMenu)
  },

  checkDefaultTheme () {
    let currentTheme = terminalThemes.getCurrentTheme()
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
    let dom = document.getElementById('outside-context')
    dom && dom.addEventListener('click', store.closeContextMenu)
  },

  initMenuEvent () {
    let dom = document.getElementById('outside-context')
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
    let { webFrame } = require('electron')
    let nl = plus
      ? webFrame.getZoomFactor() + level
      : level
    webFrame.setZoomFactor(nl)
    if (zoomOnly) {
      return
    }
    store.config.zoom = nl
  },

  checkLastSession () {
    let status = window.getGlobal('getExitStatus')()
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
    let { transferHistory } = store
    transferHistory.unshift(item)
    store.transferHistory = transferHistory.slice(0, maxTransferHistory)
  },

  onCheckUpdate () {
    if (store.onCheckUpdating) {
      return
    }
    store.shouldCheckUpdate = +new Date()
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
    let { message = 'error', stack } = e
    log.error(e)
    let msg = (
      <div className='mw240 elli wordbreak' title={message}>
        {message}
      </div>
    )
    let description = (
      <div
        className='mw300 elli common-err-desc wordbreak'
      >
        {stack}
      </div>
    )
    notification.error({
      message: msg,
      description,
      placement: 'bottomRight',
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
    let items = store[type]
    let item = _.find(items, t => t.id === id)
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
    let { currentTabId } = store
    if (currentTabId === id) {
      let next = tabs[0] || {}
      store.currentTabId = next.id
    }
    store.tabs = store.tabs.filter(t => {
      return t.id !== id
    })
  },

  addTheme (theme) {
    store.themes.unshift(theme)
    terminalThemes.addTheme(theme)
  },

  editTheme (id, update) {
    let items = store.themes
    let item = _.find(items, t => t.id === id)
    Object.assign(item, update)
    terminalThemes.updateTheme(id, update)
  },

  delTheme ({ id }) {
    store.themes = store.themes.filter(t => {
      return t.id !== id
    })
    let { theme } = store
    if (theme === id) {
      store.theme = terminalThemes.defaultTheme.id
    }
    terminalThemes.delTheme(id)
  },

  addBookmarkGroup (group) {
    store.bookmarkGroups.push(group)
  },

  editBookmarkGroup (id, update) {
    let items = store.bookmarkGroups
    let item = _.find(items, t => t.id === id)
    Object.assign(item, update)
  },

  delBookmarkGroup ({ id }) {
    if (id === defaultookmarkGroupId) {
      return
    }
    let { bookmarkGroups } = store
    let tobeDel = _.find(bookmarkGroups, bg => bg.id === id)
    if (!tobeDel) {
      return
    }
    let groups = [tobeDel]
    if (
      tobeDel.level !== 2 &&
      tobeDel.bookmarkGroupIds &&
      tobeDel.bookmarkGroupIds.length > 0
    ) {
      let childs = bookmarkGroups.filter(
        bg => tobeDel.bookmarkGroupIds.includes(bg.id)
      )
      groups = [
        ...groups,
        ...childs
      ]
    }
    let groupIds = groups.map(g => g.id)
    let defaultCatIndex = tobeDel.level !== 2
      ? _.findIndex(
        bookmarkGroups,
        g => g.id === defaultookmarkGroupId
      )
      : _.findIndex(
        bookmarkGroups,
        g => (g.bookmarkGroupIds || []).includes(tobeDel.id)
      )
    for (let g of groups) {
      if (g.bookmarkIds.length) {
        let def = bookmarkGroups[defaultCatIndex]
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
    store.theme = id
    terminalThemes.setTheme(id)
  },

  onDelItem (item, type) {
    if (item.id === store.item.id) {
      store.item = getInitItem(
        store[type],
        type
      )
    }
  },

  async reloadTab (tabToReload) {
    let tab = copy(
      tabToReload
    )
    let { id } = tab
    tab.id = generate()
    tab.status = statusMap.processing
    let tabs = store.tabs
    let index = _.findIndex(tabs, t => t.id === id)
    store.delTab({ id: tabToReload.id })
    await wait(30)
    store.addTab(tab, index)
  },

  onDuplicateTab (tab) {
    let index = _.findIndex(
      store.tabs,
      d => d.id === tab.id
    )
    store.addTab({
      ...tab,
      status: defaultStatus,
      id: generate()
    }, index + 1)
  },

  onChangeTabId (currentTabId) {
    store.currentTabId = currentTabId
  },

  onNewSsh () {
    store.setState({
      tab: settingMap.bookmarks,
      item: getInitItem([], settingMap.bookmarks),
      autofocustrigger: +new Date()
    })
    store.openModal()
  },

  onEditHistory () {
    store.setState({
      tab: settingMap.history,
      item: store.history[0] || getInitItem([], settingMap.history),
      autofocustrigger: +new Date()
    })
    store.openModal()
  },

  onSelectHistory (id) {
    let item = _.find(store.history, it => it.id === id)
    store.addTab({
      ...copy(item),
      from: 'history',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
  },

  onSelectBookmark (id) {
    let { history, bookmarks } = store
    let item = copy(
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
    let existItem = _.find(history, j => {
      let keysj = Object.keys(j)
      let keysi = Object.keys(item)
      return _.isEqual(
        _.pick(item, _.without(keysi, 'id')),
        _.pick(j, _.without(keysj, 'id'))
      )
    })
    if (!existItem) {
      store.addItem(item, settingMap.history)
    } else {
      let index = _.findIndex(history, f => f.id === existItem.id)
      history.splice(index, 1)
      history.unshift(existItem)
    }
  },

  openSetting () {
    store.setState({
      tab: settingMap.setting,
      item: getInitItem([], settingMap.setting)
    })
    store.openModal()
  },

  openTerminalThemes () {
    store.setState({
      tab: settingMap.terminalThemes,
      item: buildNewTheme(),
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
    let arr = store.getItems(tab)
    let item = getInitItem(arr, tab)
    store.setState({
      item,
      autofocustrigger: +new Date(),
      tab
    })
  },

  get list () {
    let {
      tab
    } = store
    let arr = store.getItems(tab)
    let initItem = getInitItem(arr, tab)
    return tab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
  }
})

store.clickNextTab = _.debounce(() => {
  let tab = document.querySelector('.tabs-wrapper .tab.active')
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
  let update = {
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
  let { currentTabId } = store
  let tab = _.find(tabs, t => t.id === currentTabId) || {}
  let title = createTitlte(tab)
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
  ls.set('sessions', store.tabs)
  return store.tabs
})

Subx.autoRun(store, () => {
  ls.set('bookmarks', store.bookmarks)
  return store.bookmarks
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
store.modifier = store.setState

export default store
