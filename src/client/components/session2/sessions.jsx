import { Component } from '../common/react-subx.jsx'
import Session from './session.jsx'
import WebSession from '../web/web-session.jsx'
import { findIndex, pick } from 'lodash-es'
import classNames from 'classnames'
import generate from '../../common/uid.js'
import copy from 'json-deep-copy'
import wait from '../../common/wait.js'
import Tabs from '../tabs/index.jsx'
import {
  commonActions,
  tabActions,
  termInitId,
  paneMap,
  statusMap,
  terminalWebType
} from '../../common/constants.js'
import newTerm, { updateCount } from '../../common/new-terminal.js'
import postMsg from '../../common/post-msg.js'

import LogoElem from '../common/logo-elem.jsx'
import { Button } from 'antd'
import toSimpleObj from '../../common/to-simple-obj.js'
import { shortcutExtend } from '../shortcuts/shortcut-handler.js'

const { prefix } = window
const e = prefix('tabs')
const c = prefix('control')

class Sessions extends Component {
  state = {
    tabs: [],
    currentTabId: ''
  }

  componentDidMount () {
    this.watch()
    this.initShortcuts()
  }

  initShortcuts () {
    window.addEventListener('keydown', this.handleKeyboardEvent.bind(this))
  }

  closeCurrentTabShortcut = (e) => {
    e.stopPropagation()
    this.delTab(
      this.state.currentTabId
    )
  }

  reloadCurrentTabShortcut = (e) => {
    e.stopPropagation()
    this.reloadTab(
      this.getCurrentTab()
    )
  }

  watch = () => {
    window.addEventListener('message', this.onEvent)
  }

  updateStoreTabs = (tabs) => {
    postMsg({
      action: commonActions.updateStore,
      func: 'setTabs',
      args: [copy(tabs)]
    })
  }

  updateStoreCurrentTabId = id => {
    postMsg({
      action: commonActions.updateStore,
      value: id,
      prop: 'currentTabId'
    })
    postMsg({
      action: commonActions.updateStore,
      value: id,
      prop: 'currentTabId' + this.props.batch
    })
  }

  getCurrentTab = () => {
    const {
      currentTabId,
      tabs
    } = this.state
    return tabs.find(t => t.id === currentTabId)
  }

  editTab = (id, update) => {
    this.setState((oldState) => {
      const tabs = copy(oldState.tabs)
      const tab = tabs.find(t => t.id === id)
      if (tab) {
        Object.assign(tab, update)
      }
      this.updateStoreTabs(tabs)
      return {
        tabs
      }
    })
  }

  addTab = (
    _tab,
    _index
  ) => {
    this.setState((oldState) => {
      const tabs = copy(oldState.tabs)
      const index = typeof _index === 'undefined'
        ? tabs.length
        : _index
      let tab = _tab
      if (!tab) {
        tab = newTerm()
      } else {
        updateCount(tab)
      }
      tabs.splice(index, 0, tab)
      this.updateStoreTabs(tabs)
      this.updateStoreCurrentTabId(tab.id)
      return {
        currentTabId: tab.id,
        tabs
      }
    })
  }

  delTab = (id) => {
    this.setState((oldState) => {
      const tabs = copy(oldState.tabs)
      const { currentTabId } = oldState
      const up = {}
      if (currentTabId === id) {
        let i = findIndex(tabs, t => {
          return t.id === id
        })
        i = i ? i - 1 : i + 1
        const next = tabs[i] || {}
        up.currentTabId = next.id
        this.updateStoreCurrentTabId(next.id)
      }
      up.tabs = tabs.filter(t => {
        return t.id !== id
      })
      this.updateStoreTabs(up.tabs)
      return up
    })
  }

  initFirstTab = () => {
    const tab = newTerm()
    tab.terminals = [{
      id: termInitId,
      batch: this.props.batch,
      position: 0
    }]
    this.addTab(tab)
  }

  processTerminals = (tab) => {
    if (!tab.terminals) {
      return tab
    }
    tab.terminals = tab.terminals.map(t => {
      return {
        ...t,
        stateId: t.id,
        id: generate()
      }
    })
  }

  reloadTab = async (tabToReload) => {
    this.setState(async oldState => {
      const tab = copy(
        tabToReload
      )
      tab.pane = paneMap.terminal
      this.processTerminals(tab)
      const { id } = tab
      const tabs = copy(oldState.tabs)
      tab.id = generate()
      tab.status = statusMap.processing
      const index = findIndex(tabs, t => t.id === id)
      this.addTab(tab, index)
      await wait(30)
      this.delTab(id)
    })
  }

  onDuplicateTab = (tabToDup) => {
    this.setState(oldState => {
      const defaultStatus = statusMap.processing
      let tab = copy(tabToDup)
      updateCount(tab)
      this.processTerminals(tab)
      const tabs = copy(oldState.tabs)
      const index = findIndex(
        tabs,
        d => d.id === tab.id
      )
      tab = {
        ...tab,
        status: defaultStatus,
        id: generate(),
        isTransporting: undefined
      }
      tab.pane = paneMap.terminal
      this.addTab(tab, index + 1)
    })
  }

  onChangeTabId = id => {
    this.updateStoreCurrentTabId(id)
    this.setState({
      currentTabId: id
    }, this.postChange)
  }

  setTabs = tabs => {
    this.setState({
      tabs
    })
    this.updateStoreTabs(tabs)
  }

  setOffline = () => {
    this.setState(oldState => {
      const tabs = copy(oldState.tabs)
        .map(t => {
          return {
            ...t,
            status: t.host ? statusMap.error : t.status
          }
        })
      this.updateStoreTabs(tabs)
      return {
        tabs
      }
    })
  }

  updateTabsStatus = tabIds => {
    this.setState(oldState => {
      const tabs = copy(oldState.tabs).map(d => {
        return {
          ...d,
          isTransporting: tabIds.includes(d.id)
        }
      })
      this.updateStoreTabs(tabs)
      return {
        tabs
      }
    })
  }

  onEvent = e => {
    const {
      currentTabId,
      action,
      id,
      update,
      tab,
      index,
      tabIds
    } = e.data || {}
    if (
      action === tabActions.changeCurrentTabId &&
      currentTabId &&
      currentTabId !== this.state.currentTabId
    ) {
      this.onChangeTabId(currentTabId)
    } else if (action === tabActions.updateTabs) {
      this.editTab(id, update)
    } else if (action === tabActions.addTab) {
      this.addTab(tab, index)
    } else if (action === tabActions.initFirstTab) {
      this.initFirstTab()
    } else if (action === tabActions.delTab) {
      this.delTab(id)
    } else if (action === tabActions.setAllTabOffline) {
      this.setOffline()
    } else if (action === tabActions.updateTabsStatus) {
      this.updateTabsStatus(tabIds)
    }
  }

  postChange = () => {
    this.props.store.triggerResize()
  }

  handleNewTab = () => {
    this.props.store.initFirstTab()
  }

  handleNewSsh = () => {
    this.props.store.onNewSsh()
  }

  renderNoSession = () => {
    const props = {
      style: {
        height: this.props.store.height + 'px'
      }
    }
    return (
      <div className='no-sessions electerm-logo-bg' {...props}>
        <Button
          onClick={this.handleNewTab}
          size='large'
          className='mg1r mg1b'
        >
          {e('newTab')}
        </Button>
        <Button
          onClick={this.handleNewSsh}
          size='large'
          className='mg1r mg1b'
        >
          {c('newBookmark')}
        </Button>
        <div className='pd3'>
          <LogoElem />
        </div>
      </div>
    )
  }

  renderSessions () {
    const {
      store, config, width, height
    } = this.props
    const {
      currentTabId,
      tabs
    } = this.state
    if (!tabs.length) {
      return this.renderNoSession()
    }
    return tabs.map((tab) => {
      const { id, type } = tab
      const cls = classNames(
        `session-wrap session-${id}`,
        {
          'session-current': id === currentTabId
        }
      )
      const sessProps = {
        currentTabId,
        tab: toSimpleObj(tab),
        width,
        height,
        ...pick(store, [
          'resolutions',
          'hideDelKeyTip',
          'fileOperation',
          'file',
          'activeTerminalId',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'topMenuHeight',
          'rightSidebarWidth',
          'leftSidebarWidth',
          'pinned',
          'openedSideBar'
        ]),
        config,
        ...pick(this, [
          'onChangeTabId',
          'onDuplicateTab',
          'reloadTab',
          'delTab',
          'addTab',
          'editTab'
        ])
      }
      if (type === terminalWebType) {
        const webProps = {
          tab
        }
        return (
          <div className={cls} key={id}>
            <WebSession
              {...webProps}
            />
          </div>
        )
      }
      return (
        <div className={cls} key={id}>
          <Session
            {...sessProps}
          />
        </div>
      )
    })
  }

  renderTabs = () => {
    const {
      store,
      config,
      width,
      height,
      batch
    } = this.props
    const {
      tabs,
      currentTabId
    } = this.state
    const tabsProps = {
      batch,
      currentTabId,
      config,
      width,
      height,
      ...pick(store, [
        'layout',
        'activeTerminalId',
        'isMaximized'
      ]),
      tabs,
      ...pick(this, [
        'setTabs',
        'onChangeTabId',
        'onDuplicateTab',
        'reloadTab',
        'delTab',
        'addTab',
        'editTab'
      ])
    }
    return (
      <Tabs
        key={'main-tabs' + batch}
        {...tabsProps}
      />
    )
  }

  renderSessionsWrap = () => {
    const { leftSidebarWidth, openedSideBar } = this.props.store
    const w = leftSidebarWidth + 42
    const ptp = openedSideBar
      ? {
          className: 'sessions',
          style: {
            marginLeft: `${w}px`
          }
        }
      : {
          className: 'sessions'
        }
    return (
      <div
        {...ptp}
        key='main-sess'
      >
        {this.renderSessions()}
      </div>
    )
  }

  render () {
    return [
      this.renderTabs(),
      this.renderSessionsWrap()
    ]
  }
}

export default shortcutExtend(Sessions)
