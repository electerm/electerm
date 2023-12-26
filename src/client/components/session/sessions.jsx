import { Component } from '../common/react-subx'
import Session from './session'
import { findIndex, pick } from 'lodash-es'
import classNames from 'classnames'
import generate from '../../common/uid'
import copy from 'json-deep-copy'
import wait from '../../common/wait'
import Tabs from '../tabs'
import {
  commonActions,
  tabActions,
  termInitId,
  paneMap,
  statusMap
} from '../../common/constants'
import newTerm, { updateCount } from '../../common/new-terminal'
import postMsg from '../../common/post-msg'
import TermSearch from '../terminal/term-search'
import Footer from '../footer/footer-entry'
import QuickCommandsFooterBox from '../quick-commands/quick-commands-box'
import LogoElem from '../common/logo-elem'
import { Button } from 'antd'
import toSimpleObj from '../../common/to-simple-obj'
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
      store, config
    } = this.props
    const {
      currentTabId,
      tabs
    } = this.state
    if (!tabs.length) {
      return this.renderNoSession()
    }
    return tabs.map((tab) => {
      const { id } = tab
      const cls = classNames(
        `session-wrap session-${id}`,
        {
          'session-current': id === currentTabId
        }
      )
      const sessProps = {
        currentTabId,
        tab: toSimpleObj(tab),
        ...pick(store, [
          'fileOperation',
          'file',
          'height',
          'width',
          'activeTerminalId',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'topMenuHeight',
          'rightSidebarWidth'
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
      config
    } = this.props
    const {
      tabs,
      currentTabId
    } = this.state
    const tabsProps = {
      currentTabId,
      config,
      ...pick(store, [
        'height',
        'width',
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
        key='main-tabs'
        {...tabsProps}
      />
    )
  }

  renderSessionsWrap = () => {
    const { leftSidebarWidth, openedSideBar } = this.props.store
    const w = leftSidebarWidth + 43
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
    const { store, config } = this.props
    const currentTab = this.getCurrentTab()
    const termProps = {
      currentTab,
      store,
      config
    }
    return [
      this.renderTabs(),
      this.renderSessionsWrap(),
      <TermSearch
        key='TermSearch'
        {...termProps}
      />,
      <QuickCommandsFooterBox
        key='QuickCommandsFooterBox'
        store={store}
      />,
      <Footer
        key='Footer'
        store={store}
        currentTab={currentTab}
      />
    ]
  }
}

export default shortcutExtend(Sessions)
