
/**
 * state management
 */

import {notification, message} from 'antd'
import {generate} from 'shortid'
import Subx from 'subx'
import newTerm from '../common/new-terminal'
import copy from 'json-deep-copy'
import * as terminalThemes from '../common/terminal-theme'
import {
  maxHistory,
  settingMap,
  defaultBookmarkGroupId,
  maxTransferHistory,
  statusMap,
  defaultTheme
} from '../common/constants'
import _ from 'lodash'
import createTitlte from '../common/create-title'
import openInfoModal from '../components/control/info-modal'
import {buildNewTheme} from '../common/terminal-theme'
const {getGlobal, _config, prefix} = window
const ls = getGlobal('ls')
const e = prefix('control')
const t = prefix('terminalThemes')
const defaultStatus = statusMap.processing
let tabs = [newTerm()]
let bookmarks = copy(ls.get(settingMap.bookmarks) || [])
let title = createTitlte(tabs[0])
const sshConfigItems = copy(getGlobal('sshConfigItems'))

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
const getInitItem = (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return {id: '', title: ''}
  } else if (tab === settingMap.setting) {
    return {id: '', title: e('common')}
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  }
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

  //setting
  item: getInitItem([], settingMap.bookmarks),
  tab: settingMap.bookmarks,
  autofocustrigger: + new Date(),
  bookmarkId: undefined,
  showModal: false,

  // actions
  setState (update) {
    let up = _.isFunction(update)
      ? update(store)
      : update
    Object.assign(store, up)
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

  hideModal () {
    store.showModal = false
  },

  getItemList () {
    let {tab} = store
    let arr = store.getItems(tab)
    let initItem = getInitItem(arr, tab)
    return tab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
  },

  onNewSsh () {
    store.setState({
      showModal: true,
      tab: settingMap.bookmarks,
      item: getInitItem([], settingMap.bookmarks),
      autofocustrigger: + new Date()
    })
  },

  openSetting () {
    store.setState({
      showModal: true,
      tab: settingMap.setting,
      item: getInitItem([], settingMap.setting)
    })
  },

  openTerminalThemes () {
    store.setState({
      showModal: true,
      tab: settingMap.terminalThemes,
      item: buildNewTheme(),
      autofocustrigger: + new Date()
    })
  },

  onDelItem (item, type) {
    if (item.id === store.item.id) {
      store.setState({
        item: getInitItem(
          store[type],
          type
        )
      })
    }
  },

  onSelectHistory (id) {
    let item = _.find(store.history, it => it.id === id)
    store.addTab({
      ...item,
      from: 'history',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
  },

  onSelectBookmark (id) {
    let {bookmarks} = store
    let history = copy(store.history)
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
    store.bookmarkId = id

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
      store.setState({history: history})
    }
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
      autofocustrigger: + new Date(),
      tab
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
    store.setState({
      [type]: items
    })
  },

  editItem (id, update, type, mod = store.setState) {
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
    store.setState({
      [type]: items
    })
  },

  addTab (tab = newTerm(), index = store.tabs.length)  {
    let tabs = copy(store.tabs)
    tabs.splice(index, 0, tab)
    store.setState({
      tabs,
      currentTabId: tab.id
    })
  },

  duplicateTab (tab) {
    let index = _.findIndex(
      store.tabs,
      d => d.id === tab.id
    )
    store.addTab({
      ...tab,
      status: newTerm().status,
      id: generate()
    }, index + 1)
  },

  editTab (id, update) {
    store.editItem(id, update, 'tabs', store.setState)
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
    store.setState(update)
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
    store.setState({
      bookmarkGroups
    })
  },

  editBookmarkGroup (id, update) {
    let items = copy(store.bookmarkGroups)
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    store.setState({
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
    store.setState(update)
  },

  setTheme (id) {
    store.setState({
      theme: id
    })
    terminalThemes.setTheme(id)
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
    window.postMessage({
      type: 'tab-change'
    }, '*')
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

  if (
    ['bookmarks', 'history', 'bookmarkGroups'].includes(path[0])
  ) {
    ls.set(
      _.pick(store, ['bookmarks', 'history', 'bookmarkGroups'])
    )
  }

})

export default store
