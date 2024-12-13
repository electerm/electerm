import { Component } from 'react'
import Session from './session.jsx'
import WebSession from '../web/web-session.jsx'
import { findIndex, pick } from 'lodash-es'
import classNames from 'classnames'
import generate from '../../common/id-with-stamp'
import copy from 'json-deep-copy'
import Tabs from '../tabs/index.jsx'
import {
  paneMap,
  statusMap,
  terminalWebType,
  termControlHeight
} from '../../common/constants.js'
import newTerm, { updateCount } from '../../common/new-terminal.js'
import LogoElem from '../common/logo-elem.jsx'
import { Button } from 'antd'
import toSimpleObj from '../../common/to-simple-obj.js'
import { shortcutExtend } from '../shortcuts/shortcut-handler.js'
import deepEqual from 'fast-deep-equal'

const e = window.translate

class Sessions extends Component {
  constructor (props) {
    super(props)
    this.state = {
      tabs: copy(props.tabs || []),
      currentTabId: props.currentTabId
    }
    this.bindHandleKeyboardEvent = this.handleKeyboardEvent.bind(this)
  }

  componentDidMount () {
    this.watch()
    this.initShortcuts()
  }

  componentDidUpdate (prevProps) {
    if (
      this.props.tabs &&
      !deepEqual(prevProps.tabs, this.props.tabs)
    ) {
      this.updateTabs(this.props.tabs)
    }
  }

  componentWillUnmount () {
    window.removeEventListener('message', this.onEvent)
    window.removeEventListener('keydown', this.bindHandleKeyboardEvent)
    this.timer && clearTimeout(this.timer)
    this.timer = null
  }

  updateTabs = (propTabs) => {
    const update = {
      tabs: copy(propTabs)
    }
    const currentTab = propTabs.find(t => t.id === this.state.currentTabId)
    if (!currentTab) {
      update.currentTabId = propTabs[0]?.id
    }
    this.setState(update)
  }

  initShortcuts () {
    window.addEventListener('keydown', this.bindHandleKeyboardEvent)
  }

  notCurrentTab = (tab) => {
    return this.state.currentTabId !== window.store.currentTabId
  }

  closeCurrentTabShortcut = (e) => {
    if (this.notCurrentTab()) {
      return
    }
    e.stopPropagation()
    this.delTab(
      this.state.currentTabId
    )
  }

  reloadCurrentTabShortcut = (e) => {
    if (this.notCurrentTab()) {
      return
    }
    e.stopPropagation()
    this.reloadTab(
      this.getCurrentTab()
    )
  }

  cloneToNextLayoutShortcut = (e) => {
    if (this.notCurrentTab()) {
      return
    }
    e.stopPropagation()
    window.store.cloneToNextLayout()
  }

  watch = () => {
    window.addEventListener('message', this.onEvent)
  }

  updateStoreTabs = (tabs) => {
    window.store.updateStoreTabs(tabs, this.props.batch)
  }

  updateStoreCurrentTabId = id => {
    if (id) {
      window.store.storeAssign({
        currentTabId: id,
        [id + this.props.batch]: id
      })
      this.setState({
        currentTabId: id
      })
    } else {
      document.querySelector('.tab.active')?.click()
    }
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
      return {
        tabs
      }
    }, () => {
      this.updateStoreTabs(this.state.tabs)
    })
  }

  addTab = (_tab, _index, callback) => {
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
      tab.batch = this.props.batch
      tabs.splice(index, 0, tab)
      return {
        currentTabId: tab.id,
        tabs
      }
    }, () => {
      this.updateStoreTabs(this.state.tabs)
      this.updateStoreCurrentTabId(this.state.currentTabId)
      if (callback) {
        callback()
      }
    })
  }

  // After
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
        up.currentTabId = next.id || ''
      }
      up.tabs = tabs.filter(t => {
        return t.id !== id
      })
      return up
    }, () => {
      this.updateStoreTabs(this.state.tabs)
      if (this.state.currentTabId !== id) {
        this.updateStoreCurrentTabId(this.state.currentTabId)
      }
    })
  }

  initFirstTab = () => {
    const tab = newTerm()
    const { batch } = this.props
    tab.batch = batch
    this.addTab(tab)
  }

  handleClick = () => {
    window.store.currentTabId = this.state.currentTabId
  }

  reloadTab = (tabToReload) => {
    const tab = copy(
      tabToReload
    )
    tab.pane = paneMap.terminal
    const { id } = tab
    const { tabs } = this.state
    tab.id = generate()
    tab.status = statusMap.processing
    const index = findIndex(tabs, t => t.id === id)
    this.addTab(tab, index, () => {
      this.delTab(id)
      this.onChangeTabId(tab.id)
    })
  }

  onDuplicateTab = (tabToDup) => {
    const defaultStatus = statusMap.processing
    let tab = copy(tabToDup)
    updateCount(tab)
    const tabs = copy(this.state.tabs)
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
  }

  onChangeTabId = id => {
    const matchedTab = this.state.tabs.find(t => t.id === id)
    if (!matchedTab) {
      return
    }

    // Batch the updates
    this.setState({
      currentTabId: id
    }, () => {
      this.updateStoreCurrentTabId(id)
      this.timer = setTimeout(window.store.triggerResize, 500)
      this.postChange()
    })
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
      batch,
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
    } else if (action === tabActions.addTab && (batch ?? tab.batch) === this.props.batch) {
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
    window.store.currentLayoutBatch = this.props.batch
    window.store.triggerResize()
  }

  handleNewTab = () => {
    this.initFirstTab()
  }

  handleNewSsh = () => {
    window.store.onNewSsh()
  }

  renderNoSession = () => {
    const props = {
      style: {
        height: this.props.height + 'px'
      }
    }
    return (
      <div className='no-sessions electerm-logo-bg' {...props}>
        <Button
          onClick={this.handleNewTab}
          size='large'
          className='mg1r mg1b add-new-tab-btn'
        >
          {e('newTab')}
        </Button>
        <Button
          onClick={this.handleNewSsh}
          size='large'
          className='mg1r mg1b'
        >
          {e('newBookmark')}
        </Button>
        <div className='pd3'>
          <LogoElem />
        </div>
      </div>
    )
  }

  computeHeight = () => {
    const {
      tabsHeight
    } = this.props
    return this.props.height -
      tabsHeight -
      termControlHeight
  }

  renderSessions () {
    const {
      config, width, height
    } = this.props
    const {
      currentTabId,
      tabs
    } = this.state
    if (!tabs || !tabs.length) {
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
        ...pick(this.props, [
          'batch',
          'resolutions',
          'hideDelKeyTip',
          'fileOperation',
          'file',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'leftSidebarWidth',
          'pinned',
          'openedSideBar'
        ]),
        config,
        ...pick(this, [
          'onChangeTabId',
          'onDuplicateTab',
          'reloadTab',
          'computeHeight',
          'delTab',
          'addTab',
          'editTab'
        ])
      }
      if (type === terminalWebType) {
        const webProps = {
          tab,
          width,
          height: this.computeHeight(),
          ...pick(this, [
            'reloadTab'
          ])
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
      config,
      width,
      height,
      batch,
      layout,
      isMaximized
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
      layout,
      isMaximized,
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
    return (
      <div
        className='sessions'
        key='main-sess'
        onClick={this.handleClick}
      >
        {this.renderSessions()}
      </div>
    )
  }

  render () {
    return (
      <div>
        {this.renderTabs()}
        {this.renderSessionsWrap()}
      </div>
    )
  }
}

export default shortcutExtend(Sessions)
