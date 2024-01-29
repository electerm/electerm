/**
 * file section
 */

import { Component } from 'react'
import runIdle from '../../common/run-idle'
import {
  CloseOutlined,
  Loading3QuartersOutlined,
  BorderlessTableOutlined
} from '@ant-design/icons'
import generate from '../../common/uid'
import { Tooltip, message } from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import { isEqual, findIndex, some, pick } from 'lodash-es'
import Input from '../common/input-auto-focus'
import createName from '../../common/create-title'
import { addClass, removeClass } from '../../common/class'
import {
  terminalSshConfigType,
  commonActions
} from '../../common/constants'
import { shortcutDescExtend } from '../shortcuts/shortcut-handler.js'

const { prefix } = window
const e = prefix('tabs')
const m = prefix('menu')
const onDragCls = 'ondrag-tab'
const onDragOverCls = 'dragover-tab'

class Tab extends Component {
  constructor (props) {
    super(props)
    this.state = {
      terminalOnData: false,
      tab: copy(props.tab)
    }
  }

  componentDidMount () {
    this.dom = document.getElementById('id' + this.state.tab.id)
    window.addEventListener('message', this.onEvent)
  }

  componentDidUpdate (prevProps) {
    if (!isEqual(prevProps.tab, this.props.tab)) {
      this.setState({
        tab: copy(this.props.tab)
      })
    }
  }

  componentWillUnmount () {
    window.removeEventListener('message', this.onEvent)
    window.removeEventListener('message', this.onContextAction)
    clearTimeout(this.handler)
  }

  modifier = (...args) => {
    runIdle(() => this.setState(...args))
  }

  onEvent = (e) => {
    if (
      e.data &&
      e.data.action === 'terminal-receive-data' &&
      e.data.tabId === this.state.tab.id
    ) {
      this.modifier({
        terminalOnData: true
      })
      if (this.handler) {
        clearTimeout(this.handler)
      }
      this.handler = setTimeout(this.offTerminalOnData, 4000)
    }
  }

  offTerminalOnData = () => {
    this.modifier({
      terminalOnData: false
    })
  }

  clearCls = () => {
    document.querySelectorAll('.' + onDragOverCls).forEach((d) => {
      removeClass(d, onDragOverCls)
    })
  }

  handleClick = (e) => {
    const {
      onChangeTabId
    } = this.props
    const { id } = this.state.tab
    onChangeTabId(id)
  }

  onDrag = () => {
    addClass(this.dom, onDragCls)
  }

  onDragEnter = () => {
    this.clearCls()
    addClass(this.dom, onDragOverCls)
  }

  onDragExit = () => {
    // debug('ondragexit')
    // let {target} = e
    // removeClass(target, 'sftp-dragover')
  }

  onDragLeave = e => {
    // debug('ondragleave')
    const { target } = e
    removeClass(target, onDragOverCls)
  }

  onDragOver = e => {
    // debug('ondragover')
    // debug(e.target)
    // removeClass(this.dom, 'sftp-dragover')
    e.preventDefault()
  }

  onDragStart = e => {
    // debug('ondragstart')
    // debug(e.target)
    e.dataTransfer.setData('fromFile', JSON.stringify(this.state.tab))
    // e.effectAllowed = 'copyMove'
  }

  onDrop = e => {
    e.preventDefault()
    const { target } = e
    if (!target) {
      return
    }
    // debug('target drop', target)
    const fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
    const onDropTab = document.querySelector('.' + onDragOverCls)
    if (!onDropTab || !fromTab) {
      return
    }
    const dropId = onDropTab.getAttribute('data-id')
    if (!dropId || dropId === fromTab.id) {
      return
    }
    const { id } = fromTab
    const tabs = copy(this.props.tabs)
    const indexFrom = findIndex(tabs, t => t.id === id)
    let indexDrop = findIndex(tabs, t => t.id === dropId)
    if (indexDrop > indexFrom) {
      indexDrop = indexDrop - 1
    }
    tabs.splice(indexFrom, 1)
    tabs.splice(indexDrop, 0, fromTab)
    this.props.setTabs(
      tabs
    )
    window.store.focus()
  }

  handleReloadTab = async () => {
    this.props.reloadTab(this.state.tab)
  }

  onDragEnd = e => {
    removeClass(this.dom, onDragCls)
    this.clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }

  handleClose = () => {
    this.props.delTab(this.state.tab.id)
  }

  handleDup = () => {
    this.props.onDuplicateTab(
      this.state.tab
    )
  }

  newTab = () => {
    this.props.addTab()
  }

  doRename = () => {
    const tab = copy(this.state.tab)
    tab.titleTemp = tab.title || ''
    tab.isEditting = true
    this.setState({
      tab
    })
  }

  handleBlur = () => {
    const tab = copy(this.state.tab)
    const { titleTemp, title, id, host } = tab
    if (!titleTemp && !host) {
      return message.warning(e('titleEmptyWarn'))
    }
    delete tab.isEditting
    if (title === titleTemp) {
      delete tab.titleTemp
      return this.setState({
        tab
      })
    }
    this.setState({
      tab
    })
    this.props.editTab(id, { title: titleTemp })
  }

  handleChange = e => {
    const titleTemp = e.target.value
    const tab = copy(this.state.tab)
    tab.titleTemp = titleTemp
    this.setState({
      tab
    })
  }

  closeOther = () => {
    const { setTabs, onChangeTabId } = this.props
    onChangeTabId(this.props.tab.id)
    setTabs([this.props.tab])
  }

  closeTabsRight = () => {
    const {
      tab, currentTabId,
      onChangeTabId,
      setTabs
    } = this.props
    let tabs = copy(this.props.tabs)
    const index = findIndex(tabs, t => t.id === tab.id)
    tabs = tabs.slice(0, index + 1)
    if (!some(tabs, t => t.id === currentTabId)) {
      onChangeTabId(tabs[0].id)
    }
    setTabs(tabs)
  }

  renderContext = () => {
    const { tabs, tab } = this.props
    const len = tabs.length
    const index = findIndex(tabs, t => t.id === tab.id)
    const noRight = index >= len - 1
    const isSshConfig = tab.type === terminalSshConfigType
    const res = []
    const reloadShortcut = this.getShortcut('app_reloadCurrentTab')
    res.push({
      func: 'handleClose',
      icon: 'CloseOutlined',
      text: e('close')
    })
    res.push({
      func: 'closeOther',
      icon: 'CloseOutlined',
      text: e('closeOtherTabs')
    })
    if (!noRight) {
      res.push({
        func: 'closeTabsRight',
        icon: 'CloseOutlined',
        text: e('closeTabRight')
      })
    }
    res.push({
      func: 'newTab',
      icon: 'CodeOutlined',
      text: e('newTab')
    })
    res.push({
      func: 'handleDup',
      icon: 'CopyOutlined',
      text: e('duplicate')
    })
    res.push({
      disabled: isSshConfig,
      func: 'doRename',
      icon: 'EditOutlined',
      text: e('rename')
    })
    res.push({
      func: 'handleReloadTab',
      icon: 'Loading3QuartersOutlined',
      text: m('reload'),
      subText: reloadShortcut
    })
    return res
  }

  onContextAction = e => {
    const {
      action,
      id,
      args = [],
      func
    } = e.data || {}
    if (
      action !== commonActions.clickContextMenu ||
      id !== this.uid ||
      !this[func]
    ) {
      return false
    }
    window.removeEventListener('message', this.onContextAction)
    this[func](...args)
  }

  handleContextMenu = e => {
    e.preventDefault()
    const { target } = e
    const rect = target.getBoundingClientRect()
    const items = this.renderContext()
    this.uid = generate()
    window.store.openContextMenu({
      items,
      pos: {
        left: rect.left,
        top: rect.top + 20
      },
      id: this.uid
    })
    window.addEventListener('message', this.onContextAction)
  }

  renderEditting (tab, cls) {
    const {
      titleTemp
    } = tab
    return (
      <div className={cls + ' pd1x'}>
        <Input
          value={titleTemp}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          onPressEnter={this.handleBlur}
        />
      </div>
    )
  }

  renderCloseIcon () {
    return (
      <span className='tab-close pointer'>
        <CloseOutlined onClick={this.handleClose} />
      </span>
    )
  }

  render () {
    const {
      currentTabId
    } = this.props
    const { isLast } = this.props
    const { tab, terminalOnData } = this.state
    const { id, isEditting, status, isTransporting } = tab
    const active = id === currentTabId
    const cls = classnames(
      `tab-${id}`,
      'tab',
      { active },
      {
        'tab-last': isLast
      },
      status,
      {
        'is-terminal-active': terminalOnData
      },
      {
        'is-transporting': isTransporting
      }
    )
    const title = createName(tab)
    if (isEditting) {
      return this.renderEditting(tab, cls)
    }
    const { tabCount, color } = tab
    const styleTag = color
      ? { borderTop: `1px solid ${color}` }
      : {}
    return (
      <Tooltip
        title={title}
        placement='top'
      >
        <div
          className={cls}
          draggable
          id={'id' + id}
          data-id={id}
          {...pick(this, [
            'onDrag',
            'onDragEnter',
            'onDragExit',
            'onDragLeave',
            'onDragOver',
            'onDragStart',
            'onDrop',
            'onDragEnd'
          ])}
        >
          <div
            className='tab-title elli pd1x'
            onClick={this.handleClick}
            onDoubleClick={this.handleDup}
            style={styleTag}
            onContextMenu={this.handleContextMenu}
          >
            <Loading3QuartersOutlined
              className='pointer tab-reload mg1r'
              onClick={this.handleReloadTab}
              title={m('reload')}
            />
            <span className='tab-title'>
              {tabCount}. {title}
            </span>
          </div>
          <div className={'tab-status ' + status} />
          <div className='tab-traffic' />
          <BorderlessTableOutlined className='tab-terminal-feed' />
          {
            this.renderCloseIcon()
          }
        </div>
      </Tooltip>
    )
  }
}

export default shortcutDescExtend(Tab)
