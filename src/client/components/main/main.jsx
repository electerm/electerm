
import React from 'react'
import Wrapper from '../terminal'
import newTerm from '../../common/new-terminal'
import _ from 'lodash'
import copy from 'json-deep-copy'
import ContextMenu from '../common/context-menu'
import FileInfoModal from '../sftp/file-props-modal'
import FileModeModal from '../sftp/file-mode-modal'
import UpdateCheck from './update-check'
import {notification} from 'antd'
import openInfoModal from '../control/info-modal'
import * as terminalThemes from '../../common/terminal-theme'
import createTitlte from '../../common/create-title'
import {
  maxHistory,
  settingMap,
  defaultookmarkGroupId,
  maxTransferHistory
} from '../../common/constants'
import Control from '../control'
import SessionControl from '../session-control'
import './wrapper.styl'

const {getGlobal, _config} = window
const ls = getGlobal('ls')
const {prefix} = window
const t = prefix('terminalThemes')
let sessionsGlob = copy(ls.get('sessions'))

export default class Index extends React.Component {

  constructor(props) {
    super(props)
    let tabs = [newTerm()]
    let bookmarks = copy(ls.get(settingMap.bookmarks) || [])
    this.state = {
      tabs,
      height: 500,
      width: window.innerWidth,
      currentTabId: tabs[0].id,
      history: copy(ls.get(settingMap.history) || []),
      bookmarks,
      bookmarkGroups: copy(
        ls.get(settingMap.bookmarkGroups) ||
        this.getDefaultBookmarkGroups(bookmarks)
      ),
      isMaximized: window.getGlobal('isMaximized')(),
      config: _config || {},
      contextMenuProps: {},
      transferHistory: [],
      themes: terminalThemes.getThemes(),
      theme: terminalThemes.getCurrentTheme().id,
      showControl: true,
      contextMenuVisible: false,
      fileInfoModalProps: {},
      fileModeModalProps: {},
      currentBookmarkGroupId: defaultookmarkGroupId,
      shouldCheckUpdate: 0,
      transferHistoryModalVisible: false,
      onCheckUpdating: false,
      selectedSessions: [],
      sessionModalVisible: false
    }
    let title = createTitlte(tabs[0])
    window.getGlobal('setTitle')(title)
  }

  componentDidMount() {
    window.lang = copy(window.lang)
    window._config = copy(window._config)
    window.addEventListener('resize', this.onResize)
    this.onResize()
    window._require('electron')
      .ipcRenderer
      .on('checkupdate', this.onCheckUpdate)
      .on('open-about', this.openAbout)
      .on('toggle-control', this.toggleControl)
    document.addEventListener('drop', function(e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function(e) {
      e.preventDefault()
      e.stopPropagation()
    })
    this.checkLastSession()
  }

  componentDidUpdate(prevProps, prevState) {
    let {currentTabId} = this.state
    if (
      prevState.currentTabId !== currentTabId &&
      currentTabId
    ) {
      let term = _.get(this, `term_${currentTabId}.term`)
      term && term.focus()
    }
  }

  onResize = _.throttle(() => {
    let update = {
      height: window.innerHeight,
      width: window.innerWidth,
      isMaximized: window.getGlobal('isMaximized')()
    }
    this.setState(update)
    window
      .getGlobal('lastStateManager')
      .set('windowSize', update)
  }, 100)

  setStateLs = (update) => {
    Object.keys(update).forEach(k => {
      ls.set(k, update[k])
    })
    this.setState(update)
  }

  modifyLs = (...args) => {
    this.setStateLs(...args)
  }

  modifier = (...args) => {
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

  maximize = () => {

  }

  initEvent = () => {
    let dom = document.getElementById('outside-context')
    this.dom = dom
    dom.addEventListener('click', this.closeContextMenu)
  }

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
    if (_.isUndefined(sessions)) {
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
      onCheckUpdatingo: this.nCheckUpdating,
      onCheckUpdate: this.onCheckUpdate
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

  toggleControl = () => {
    this.setState(old => {
      old.showControl = !old.showControl
      return old
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
    this.initEvent()
  }

  closeContextMenu = () => {
    this.setState({
      contextMenuVisible: false
    })
    this.dom && this.dom.removeEventListener('click', this.closeContextMenu)
  }

  onError = e => {
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

  addTab = (tab, index = this.state.tabs.length) => {
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
    if (tobeDel.bookmarkIds.length) {
      let defaultCatIndex = _.findIndex(
        bookmarkGroups,
        g => g.id === defaultookmarkGroupId
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

  render() {
    let {
      tabs,
      currentTabId,
      contextMenuProps,
      contextMenuVisible,
      fileInfoModalProps,
      fileModeModalProps,
      shouldCheckUpdate,
      showControl
    } = this.state
    let {themes, theme} = this.state
    let themeConfig = (_.find(themes, d => d.id === theme) || {}).themeConfig || {}
    let controlProps = {
      ...this.state,
      themeConfig,
      ..._.pick(this, [
        'modifier', 'delTab', 'addTab', 'editTab',
        'openTransferHistory',
        'clearTransferHistory',
        'closeTransferHistory',
        'addTransferHistory',
        'onError', 'openContextMenu', 'closeContextMenu',
        'modifyLs', 'addItem', 'editItem', 'delItem',
        'onCheckUpdate', 'openAbout',
        'setTheme', 'addTheme', 'editTheme', 'delTheme',
        'addBookmarkGroup',
        'editBookmarkGroup',
        'delBookmarkGroup'
      ])
    }
    let sessProps = {
      ..._.pick(this, [
        'modifier', 'addTab'
      ]),
      ..._.pick(this.state, [
        'sessionModalVisible',
        'selectedSessions'
      ])
    }
    return (
      <div>
        <SessionControl {...sessProps} />
        <UpdateCheck
          modifier={this.modifier}
          shouldCheckUpdate={shouldCheckUpdate}
        />
        <ContextMenu
          {...contextMenuProps}
          visible={contextMenuVisible}
        />
        <FileInfoModal
          {...fileInfoModalProps}
        />
        <FileModeModal
          key={_.get(fileModeModalProps, 'file.id') || ''}
          {...fileModeModalProps}
        />
        <div
          id="outside-context"
          className={showControl ? 'show-control' : 'hide-control'}
        >
          <Control
            {...controlProps}
          />
          <div className="ui-outer">
            {
              tabs.map((tab) => {
                let {id} = tab
                let cls = id !== currentTabId
                  ? 'hide'
                  : 'ssh-wrap-show'
                return (
                  <div className={cls} key={id}>
                    <Wrapper
                      {...controlProps}
                      tab={tab}
                      ref={ref => this[`term_${id}`] = ref}
                    />
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    )
  }

}
