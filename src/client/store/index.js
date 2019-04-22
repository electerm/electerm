/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import Subx from 'subx'
//import React from 'react'
import {message} from 'antd'
// import Session from '../session'
// import Tabs from '../tabs'
import newTerm from '../../common/new-terminal'
import _ from 'lodash'
//import {generate} from 'shortid'
import copy from 'json-deep-copy'
// import ContextMenu from '../common/context-menu'
// import FileInfoModal from '../sftp/file-props-modal'
// import wait from '../../common/wait'
// import FileModeModal from '../sftp/file-mode-modal'
// import UpdateCheck from './upgrade'
// import {notification} from 'antd'
// import SettingModal from '../setting-panel/setting-modal'
// import openInfoModal from '../sidebar/info-modal'
import * as terminalThemes from '../../common/terminal-theme'
// import createTitlte from '../../common/create-title'
// import TextEditor from '../text-editor'
// import Sidebar from '../sidebar'
// import SystemMenu from './system-menu'
import {
  //maxHistory,
  settingMap,
  defaultookmarkGroupId,
  //maxTransferHistory,
  sidebarWidth,
  statusMap,
  defaultTheme
} from '../../common/constants'
//import SessionControl from '../session-control'
import {buildNewTheme} from '../../common/terminal-theme'
import './wrapper.styl'

const {getGlobal, _config} = window
const ls = getGlobal('ls')
const {prefix} = window
const t = prefix('terminalThemes')
const e = prefix('control')
// const defaultStatus = statusMap.processing
// let sessionsGlob = copy(ls.get('sessions'))
// const sshConfigItems = copy(getGlobal('sshConfigItems'))
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

let tabs = [newTerm()]
let bookmarks = copy(ls.get(settingMap.bookmarks) || [])
let bookmarkGroups = copy(
  ls.get(settingMap.bookmarkGroups) ||
  this.getDefaultBookmarkGroups(bookmarks)
)

const store = Subx.create({
  tabs,
  height: 500,
  width: window.innerWidth - sidebarWidth,
  currentTabId: tabs[0].id,
  history: copy(ls.get(settingMap.history) || []),
  bookmarks,
  bookmarkGroups,
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

  //for settings related
  tab: settingMap.bookmarks,
  autofocustrigger: + new Date(),
  bookmarkId: undefined,
  showModal: false,
  activeTerminalId: '',

  //sidebar
  openedSideBar: '',
  openedCategoryIds: ls.get('openedCategoryIds') || bookmarkGroups.map(b => b.id),
  menuOpened: false,

  //update
  shouldCheckUpdate: 0,
  upgradeInfo: {},

  // methods
  focus () {
    window.postMessage({
      type: 'focus'
    }, '*')
  },

  openMenu () {
    store.menuOpened = true
    //todo subscribe
  },

  closeMenu () {
    store.menuOpened = false
    //todo subscribe
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
    let tabs = copy(store.tabs)
      .map(t => {
        return {
          ...t,
          status: t.host ? statusMap.error: t.status
        }
      })
    this.modifier({
      tabs
    })
  }//,

  // onResize = _.debounce(() => {
  //   let update = {
  //     height: window.innerHeight,
  //     width: window.innerWidth - sidebarWidth,
  //     isMaximized: window.getGlobal('isMaximized')()
  //   }
  //   this.setState(update)
  //   window
  //     .getGlobal('lastStateManager')
  //     .set('windowSize', update)
  // }, 100)
  //todo debounce

  // setStateLs (update) => {
  //   Object.keys(update).forEach(k => {
  //     ls.set(k, update[k])
  //   })
  //   this.setState(update)
  // }
  // todo subscibe

  // modifyLs = (...args) => {
  //   this.setStateLs(...args)
  // }
  //todo subscribe
/*
  modifier (...args) {
    let update = args[0]
    let changed = (update.currentTabId && update.currentTabId !== this.state.currentTabId) || update.tabs
    if (changed) {
      let currentTabId = update.currentTabId || this.state.currentTabId
      let tabs = update.tabs || this.state.tabs
      let tab = _.find(tabs, t => t.id === currentTabId) || {}
      let title = createTitlte(tab)
      window.getGlobal('setTitle')(title)
    }
    this.setState(...args)
    if (update.tabs) {
      ls.set('sessions', update.tabs)
    }
  }
  //todo use subscribe

  initContextEvent = () => {
    let dom = document.getElementById('outside-context')
    this.dom = dom
    dom.addEventListener('click', this.closeContextMenu)
  }

  initMenuEvent = () => {
    let dom = document.getElementById('outside-context')
    this.dom = dom
    dom.addEventListener('click', this.closeMenu)
  }

  selectall = () => {
    document.activeElement &&
    document.activeElement.select &&
    document.activeElement.select()
    window.postMessage({
      event: 'selectall',
      id: store.activeTerminalId
    }, '*')
  }

  zoom = (level = 1, plus = false, zoomOnly) => {
    let {webFrame} = require('electron')
    let nl = plus
      ? webFrame.getZoomFactor() + level
      : level
    webFrame.setZoomFactor(nl)
    if (zoomOnly) {
      return
    }
    this.setState(old => {
      let nc = {
        ...old.config,
        zoom: nl
      }
      getGlobal('saveUserConfig')(nc)
      return {
        config: nc
      }
    })
  }

  clickNextTab = _.debounce(() => {
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

  getDefaultBookmarkGroups = (bookmarks) => {
    return [
      {
        title: t(defaultookmarkGroupId),
        id: defaultookmarkGroupId,
        bookmarkIds: bookmarks.map(d => d.id)
      }
    ]
  }

  checkLastSession = () => {
    let status = window.getGlobal('getExitStatus')()
    if (status === 'ok') {
      return
    }
    this.showLastSessions(sessionsGlob)
  }

  showLastSessions = sessions => {
    if (!sessions) {
      return
    }
    this.setState({
      selectedSessions: copy(sessions).map(s => ({
        id: s.id,
        tab: s,
        checked: true
      })),
      sessionModalVisible: true
    })
  }

  openAbout = () => {
    openInfoModal({
      onCheckUpdating: this.state.upgradeInfo.checkingRemoteVersion || this.state.upgradeInfo.upgrading,
      onCheckUpdate: this.onCheckUpdate,
      onCancel: this.focus,
      onOk: this.focus
    })
  }

  openTransferHistory = () => {
    this.setState({
      transferHistoryModalVisible: true
    })
  }

  closeTransferHistory = () => {
    this.setState({
      transferHistoryModalVisible: false
    })
  }

  clearTransferHistory = () => {
    this.setState({
      transferHistory: [],
      transferHistoryModalVisible: false
    })
  }

  addTransferHistory = (item) => {
    let transferHistory = [
      item,
      ...copy(this.state.transferHistory)
    ].slice(0, maxTransferHistory)
    this.setState({
      transferHistory
    })
  }

  onCheckUpdate = () => {
    if (this.state.onCheckUpdating) {
      return
    }
    this.setState({
      shouldCheckUpdate: +new Date()
    })
  }

  openContextMenu = (contextMenuProps) => {
    this.setState({
      contextMenuProps,
      contextMenuVisible: true
    })
    this.initContextEvent()
  }

  closeContextMenu = () => {
    this.setState({
      contextMenuVisible: false
    })
    this.dom && this.dom.removeEventListener('click', this.closeContextMenu)
  }

  onError = e => {
    let {message = 'error', stack} = e
    log.error(e)
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
      placement: 'bottomRight',
      duration: 55
    })
  }

  addItem = (item, type) => {
    let items = copy(this.state[type])
    items.unshift(item)
    if (type === settingMap.history && items.length > maxHistory) {
      items = items.slice(0, maxHistory)
    }
    this.setStateLs({
      [type]: items
    })
  }

  editItem = (id, update, type, mod = this.setStateLs) => {
    let items = copy(this.state[type])
    let item = _.find(items, t => t.id === id)
    if (!item) {
      return
    }
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    mod({
      [type]: items
    })
  }

  delItem = ({id}, type) => {
    let items = copy(this.state[type]).filter(t => {
      return t.id !== id
    })
    this.setStateLs({
      [type]: items
    })
  }

  addTab = (tab = newTerm(), index = this.state.tabs.length) => {
    let tabs = copy(this.state.tabs)
    tabs.splice(index, 0, tab)
    this.modifier({
      tabs,
      currentTabId: tab.id
    })
  }

  editTab = (id, update) => {
    this.editItem(id, update, 'tabs', this.modifier)
  }

  delTab = ({id}) => {
    let tabs = copy(this.state.tabs).filter(t => {
      return t.id !== id
    })
    let {currentTabId} = this.state
    let update = {
      tabs
    }
    if (currentTabId === id) {
      let next = tabs[0] || {}
      update.currentTabId = next.id
    }
    this.modifier(update)
  }

  addTheme = (theme) => {
    let themes = copy(this.state.themes)
    themes = [
      theme,
      ...themes
    ]
    this.setState({
      themes
    })
    terminalThemes.addTheme(theme)
  }

  editTheme = (id, update) => {
    let items = copy(this.state.themes)
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    this.setState({
      themes: items
    })
    terminalThemes.updateTheme(id, update)
  }

  delTheme = ({id}) => {
    let themes = copy(this.state.themes).filter(t => {
      return t.id !== id
    })
    let {theme} = this.state
    let update = {
      themes
    }
    if (theme === id) {
      update.theme = terminalThemes.defaultTheme.id
    }
    this.setState(update)
    terminalThemes.delTheme(id)
  }

  addBookmarkGroup = (group) => {
    let bookmarkGroups = copy(this.state.bookmarkGroups)
    bookmarkGroups = [
      ...bookmarkGroups,
      group
    ]
    this.setStateLs({
      bookmarkGroups
    })
  }

  editBookmarkGroup = (id, update) => {
    let items = copy(this.state.bookmarkGroups)
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    this.setStateLs({
      bookmarkGroups: items
    })
  }

  delBookmarkGroup = ({id}) => {
    if (id === defaultookmarkGroupId) {
      return
    }
    let bookmarkGroups = copy(this.state.bookmarkGroups)
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
    let update = {
      bookmarkGroups
    }
    if (id === this.state.currentBookmarkGroupId) {
      update.currentBookmarkGroupId = ''
    }
    this.setStateLs(update)
  }

  setTheme = id => {
    this.setState({
      theme: id
    })
    terminalThemes.setTheme(id)
  }

  onDelItem = (item, type) => {
    if (item.id === this.state.item.id) {
      this.setState((old) => {
        return {
          item: getInitItem(
            old[type],
            type
          )
        }
      })
    }
  }

  reloadTab = async (tabToReload) => {
    let tab = copy(
      tabToReload
    )
    let {id} = tab
    tab.id = generate()
    tab.status = statusMap.processing
    let tabs = copy(this.state.tabs)
    let index = _.findIndex(tabs, t => t.id === id)
    this.delTab({id: tabToReload.id})
    await wait(30)
    this.addTab(tab, index)
  }

  onDuplicateTab = tab => {
    let index = _.findIndex(
      this.state.tabs,
      d => d.id === tab.id
    )
    this.addTab({
      ...tab,
      status: defaultStatus,
      id: generate()
    }, index + 1)
  }

  onChangeTabId = currentTabId => {
    this.modifier({currentTabId})
  }

  onNewSsh = () => {
    this.setState({
      tab: settingMap.bookmarks,
      item: getInitItem([], settingMap.bookmarks),
      autofocustrigger: + new Date()
    }, this.openModal)
  }

  onEditHistory = () => {
    this.setState({
      tab: settingMap.history,
      item: this.state.history[0] || getInitItem([], settingMap.history),
      autofocustrigger: + new Date()
    }, this.openModal)
  }

  onSelectHistory = id => {
    let item = _.find(this.state.history, it => it.id === id)
    this.addTab({
      ...copy(item),
      from: 'history',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
  }

  onSelectBookmark = id => {
    let {history, bookmarks} = this.state
    let item = copy(
      _.find(bookmarks, it => it.id === id) ||
      _.find(sshConfigItems, it => it.id === id)
    )
    if (!item) {
      return
    }
    this.addTab({
      ...item,
      from: 'bookmarks',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
    item.id = generate()
    if (this.state.config.disableSshHistory) {
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
      this.addItem(item, settingMap.history)
    } else {
      let historyNew = copy(history)
      let index = _.findIndex(historyNew, f => f.id === existItem.id)
      historyNew.splice(index, 1)
      historyNew.unshift(existItem)
      this.modifier({history: historyNew})
    }
  }

  openSetting = () => {
    this.setState({
      tab: settingMap.setting,
      item: getInitItem([], settingMap.setting)
    }, this.openModal)
  }

  openTerminalThemes = () => {
    this.setState({
      tab: settingMap.terminalThemes,
      item: buildNewTheme(),
      autofocustrigger: + new Date()
    }, this.openModal)
  }

  openModal = () => {
    this.setState({
      showModal: true
    })
  }

  hideModal = () => {
    this.setState({
      showModal: false
    })
    this.focus()
  }

  getItems = (tab, props = this.state) => {
    return tab === settingMap.terminalThemes
      ? copy(props.themes)
      : copy(props[tab]) || []
  }

  onChangeTab = tab => {
    let arr = this.getItems(tab)
    let item = getInitItem(arr, tab)
    this.setState({
      item,
      autofocustrigger: + new Date(),
      tab
    })
  }

  getList = () => {
    let {
      tab
    } = this.state
    let arr = this.getItems(tab)
    let initItem = getInitItem(arr, tab)
    return tab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
  }
  */
})
