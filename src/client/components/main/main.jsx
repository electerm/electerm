
import React from 'react'
import Wrapper from '../terminal'
import Control, {newTerm} from '../control'
import _ from 'lodash'
import copy from 'json-deep-copy'
import ContextMenu from '../common/context-menu'
import FileInfoModal from '../sftp/file-props-modal'
import FileModeModal from '../sftp/file-mode-modal'
import UpdateCheck from './update-check'
import {notification} from 'antd'
import openInfoModal from '../control/info-modal'
import {getThemes, getCurrentTheme} from '../../common/theme'
import {maxHistory, settingMap, maxTransferHistory} from '../../common/constants'
import './wrapper.styl'

const {getGlobal, _config} = window
const ls = getGlobal('ls')

export default class Index extends React.Component {

  constructor(props) {
    super(props)
    let tabs = [newTerm()]
    this.state = {
      tabs,
      height: 500,
      width: window.innerWidth,
      currentTabId: tabs[0].id,
      history: ls.get(settingMap.history) || [],
      bookmarks: ls.get(settingMap.bookmarks) || [],
      config: _config || {},
      contextMenuProps: {},
      transferHistory: [],
      themes: getThemes(),
      theme: getCurrentTheme(),
      showControl: true,
      contextMenuVisible: false,
      fileInfoModalProps: {},
      fileModeModalProps: {},
      shouldCheckUpdate: 0,
      transferHistoryModalVisible: false,
      onCheckUpdating: false
    }
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize)
    this.onResize()
    window._require('electron')
      .ipcRenderer
      .on('checkupdate', this.onCheckUpdate)
      .on('open-about', this.openAbout)
      .on('toggle-control', this.toggleControl)
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
    this.setState({
      height: window.innerHeight,
      width: window.innerWidth
    })
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
    this.setState(...args)
  }

  initEvent = () => {
    let dom = document.getElementById('outside-context')
    this.dom = dom
    dom.addEventListener('click', this.closeContextMenu)
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
    console.log(new Date + '', stack, _.isString(stack))
    let msg = (
      <div className="mw240 elli wordbreak" title={message}>
        {message}
      </div>
    )
    let description = (
      <pre
        className="mw300 elli common-err-desc wordbreak"
        title={stack}
      >
        {stack}
      </pre>
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
    this.setState({
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
    this.setState(update)
  }

  render() {
    let {
      tabs,
      currentTabId,
      contextMenuProps,
      contextMenuVisible,
      fileInfoModalProps,
      fileModeModalProps,
      shouldCheckUpdate
    } = this.state
    let controlProps = {
      ...this.state,
      ..._.pick(this, [
        'modifier', 'delTab', 'addTab', 'editTab',
        'openTransferHistory',
        'clearTransferHistory',
        'closeTransferHistory',
        'addTransferHistory',
        'onError', 'openContextMenu', 'closeContextMenu',
        'modifyLs', 'addItem', 'editItem', 'delItem',
        'onCheckUpdate', 'openAbout'
      ])
    }
    return (
      <div>
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
          {...fileModeModalProps}
        />
        <div id="outside-context">
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
