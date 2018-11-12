
/**
 * state management
 */

import {notification} from 'antd'
import Subx from 'subx'
import newTerm from '../common/new-terminal'
import copy from 'json-deep-copy'
import * as terminalThemes from '../common/terminal-theme'
import {
  maxHistory,
  settingMap,
  defaultBookmarkGroupId,
  maxTransferHistory,
  statusMap
} from '../common/constants'
import _ from 'lodash'
import createTitlte from '../common/create-title'
import openInfoModal from '../components/control/info-modal'

const {getGlobal, _config} = window
const ls = getGlobal('ls')
const {prefix} = window
const t = prefix('terminalThemes')

let tabs = [newTerm()]
let bookmarks = copy(ls.get(settingMap.bookmarks) || [])
let title = createTitlte(tabs[0])

window.getGlobal('setTitle')(title)

let getDefaultBookmarkGroups = (bookmarks) => {
  return [
    {
      title: t(defaultBookmarkGroupId),
      id: defaultBookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    }
  ]
}

const store = Subx.create({

  //states
  tabs,
  bookmarks,
  history: copy(ls.get(settingMap.history) || []),
  height: 500,
  width: window.innerWidth,
  currentTabId: tabs[0].id || '',
  bookmarkGroups: copy(
    ls.get(settingMap.bookmarkGroups) ||
    getDefaultBookmarkGroups(bookmarks)
  ),
  isMaximized: window.getGlobal('isMaximized')(),
  config: copy(_config) || {},
  contextMenuProps: {},
  transferHistory: [],
  themes: terminalThemes.getThemes(),
  theme: terminalThemes.getCurrentTheme().id,
  showControl: true,
  contextMenuVisible: false,
  fileInfoModalProps: {},
  fileModeModalProps: {},
  currentBookmarkGroupId: defaultBookmarkGroupId,
  transferHistoryModalVisible: false,
  onCheckUpdating: false,
  selectedSessions: [],
  sessionModalVisible: false,
  textEditorProps: {},

  // actions
  setState (update) {
    let up = _.isFunction(update)
      ? update(store)
      : update
    Object.assign(store, up)
  },

  setStateLs (update) {
    Object.keys(update).forEach(k => {
      ls.set(k, update[k])
    })
    store.setState(update)
  },

  modifyLs (...args) {
    store.setStateLs(...args)
  },

  modifier (...args) {
    store.setState(...args)
  },

  onCheckUpdate () {
    window.postMessage({
      type: 'check-update'
    }, '*')
  },

  openAbout () {
    openInfoModal({
      onCheckUpdating: store.onCheckUpdating,
      onCheckUpdate: store.onCheckUpdate
    })
  },

  getThemeConfig () {
    return (_.find(store.themes, d => d.id === store.theme)).themeConfig || {}
  },

  setOffline () {
    store.tabs = store.tabs.map(t => {
      return {
        ...t,
        status: t.host ? statusMap.error: t.status
      }
    })
  },

  clickNextTab () {
    //todo debounced
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
    let transferHistory = [
      item,
      ...copy(store.transferHistory)
    ].slice(0, maxTransferHistory)
    store.setState({
      transferHistory
    })
  },

  openContextMenu (contextMenuProps) {
    store.setState({
      contextMenuProps,
      contextMenuVisible: true
    })
    let dom = document.getElementById('outside-context')
    dom.addEventListener('click', store.closeContextMenu)
  },

  closeContextMenu () {
    store.setState({
      contextMenuVisible: false
    })
    let dom = document.getElementById('outside-context')
    dom && dom.removeEventListener('click', store.closeContextMenu)
  },

  onError (e) {
    let {message = 'error', stack} = e
    console.log(new Date + '', stack)
    let msg = (
      <div className="mw240 elli wordbreak" title={message}>
        {message}
      </div>
    )
    let description = (
      <div
        className="mw300 elli common-err-desc wordbreak"
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
    let items = copy(store[type])
    items.unshift(item)
    if (type === settingMap.history && items.length > maxHistory) {
      items = items.slice(0, maxHistory)
    }
    store.setStateLs({
      [type]: items
    })
  },

  editItem (id, update, type, mod = store.setStateLs) {
    let items = copy(store[type])
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    mod({
      [type]: items
    })
  },

  delItem ({id}, type) {
    let items = copy(store[type]).filter(t => {
      return t.id !== id
    })
    store.setStateLs({
      [type]: items
    })
  },

  addTab (tab, index = store.tabs.length)  {
    let tabs = copy(store.tabs)
    tabs.splice(index, 0, tab)
    store.modifier({
      tabs,
      currentTabId: tab.id
    })
  },

  editTab (id, update) {
    store.editItem(id, update, 'tabs', store.modifier)
  },

  delTab ({id}) {
    let tabs = copy(store.tabs).filter(t => {
      return t.id !== id
    })
    let {currentTabId} = store
    let update = {
      tabs
    }
    if (currentTabId === id) {
      let next = tabs[0] || {}
      update.currentTabId = next.id
    }
    store.modifier(update)
  },

  addTheme (theme) {
    let themes = copy(store.themes)
    themes = [
      theme,
      ...themes
    ]
    store.setState({
      themes
    })
    terminalThemes.addTheme(theme)
  },

  editTheme (id, update) {
    let items = copy(store.themes)
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    store.setState({
      themes: items
    })
    terminalThemes.updateTheme(id, update)
  },

  delTheme ({id}) {
    let themes = copy(store.themes).filter(t => {
      return t.id !== id
    })
    let {theme} = store
    let update = {
      themes
    }
    if (theme === id) {
      update.theme = terminalThemes.defaultTheme.id
    }
    store.setState(update)
    terminalThemes.delTheme(id)
  },

  addBookmarkGroup (group) {
    let bookmarkGroups = copy(store.bookmarkGroups)
    bookmarkGroups = [
      ...bookmarkGroups,
      group
    ]
    store.setStateLs({
      bookmarkGroups
    })
  },

  editBookmarkGroup (id, update) {
    let items = copy(store.bookmarkGroups)
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    store.setStateLs({
      bookmarkGroups: items
    })
  },

  delBookmarkGroup ({id}) {
    if (id === defaultBookmarkGroupId) {
      return
    }
    let bookmarkGroups = copy(store.bookmarkGroups)
    let tobeDel = _.find(bookmarkGroups, bg => bg.id === id)
    if (!tobeDel) {
      return
    }
    if (tobeDel.bookmarkIds.length) {
      let defaultCatIndex = _.findIndex(
        bookmarkGroups,
        g => g.id === defaultBookmarkGroupId
      )
      let def = bookmarkGroups[defaultCatIndex]
      def.bookmarkIds = [
        ...tobeDel.bookmarkIds,
        ...def.bookmarkIds
      ]
    }
    bookmarkGroups = bookmarkGroups.filter(t => {
      return t.id !== id
    })
    let update = {
      bookmarkGroups
    }
    if (id === store.currentBookmarkGroupId) {
      update.currentBookmarkGroupId = ''
    }
    store.setStateLs(update)
  },

  setTheme (id) {
    store.setState({
      theme: id
    })
    terminalThemes.setTheme(id)
  }
  //end
}, true)

store.$.subscribe((event) => {
  let {type, path} = event
  if (
    type === 'SET' &&
    path.includes('tabs') ||
    path.includes('currentTabId')
  ) {
    let {currentTabId, tabs} = store
    let tab = _.find(tabs, t => t.id === currentTabId) || {}
    if (!tab) {
      return
    }
    let title = createTitlte(tab)
    window.getGlobal('setTitle')(title)
    if (path.includes('tabs')) {
      ls.set('sessions', store.tabs)
    }
  }

  else if (path.includes('themes') || path.includes('theme')) {
    window.postMessage({
      type: 'theme-change',
      id: 'all'
    }, '*')
  }
  else if (path.includes('config')) {
    window.postMessage({
      type: 'config-change',
      id: 'all'
    }, '*')
  }
})

export default store
