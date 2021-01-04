/**
 * file section
 */

import React from 'react'
import runIdle from '../../common/run-idle'
import {
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  EditOutlined,
  Loading3QuartersOutlined,
  BorderlessTableOutlined
} from '@ant-design/icons'

import { Tooltip, message } from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import createName from '../../common/create-title'
import { addClass, removeClass } from '../../common/class'
import {
  terminalSshConfigType,
  ctrlOrCmd
} from '../../common/constants'

const { prefix } = window
const e = prefix('tabs')
const m = prefix('menu')
const onDragCls = 'ondrag-tab'
const onDragOverCls = 'dragover-tab'

export default class Tab extends React.Component {
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
    if (!_.isEqual(prevProps.tab, this.props.tab)) {
      this.setState({
        tab: copy(this.props.tab)
      })
    }
  }

  componentWillUnmount () {
    window.removeEventListener('message', this.onEvent)
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
    const indexFrom = _.findIndex(tabs, t => t.id === id)
    let indexDrop = _.findIndex(tabs, t => t.id === dropId)
    if (indexDrop > indexFrom) {
      indexDrop = indexDrop - 1
    }
    tabs.splice(indexFrom, 1)
    tabs.splice(indexDrop, 0, fromTab)
    this.props.store.storeAssign({
      tabs
    })
  }

  reloadTab = async () => {
    this.props.store.reloadTab(this.state.tab)
  }

  onDragEnd = e => {
    removeClass(this.dom, onDragCls)
    this.clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }

  close = () => {
    this.props.store.delTab({ id: this.state.tab.id })
    if (this.props.tabs.length <= 1) {
      setTimeout(this.props.store.addTab, 1)
    }
  }

  dup = () => {
    this.props.store.onDuplicateTab(this.props.tab)
  }

  doRename = () => {
    const tab = copy(this.state.tab)
    tab.titleTemp = tab.title || ''
    tab.isEditting = true
    this.setState({
      tab
    })
  }

  onBlur = () => {
    const tab = copy(this.state.tab)
    const { titleTemp, title, id, host } = tab
    if (!titleTemp && !host) {
      return message.warn(e('titleEmptyWarn'))
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
    this.props.store.editTab(id, { title: titleTemp })
  }

  onChange = e => {
    const titleTemp = e.target.value
    const tab = copy(this.state.tab)
    tab.titleTemp = titleTemp
    this.setState({
      tab
    })
  }

  closeOther = () => {
    this.props.store.storeAssign({
      tabs: [this.props.tab],
      currentTabId: this.props.tab.id
    })
  }

  closeTabsRight = () => {
    let { tabs, tab, currentTabId } = this.props
    const index = _.findIndex(tabs, t => t.id === tab.id)
    tabs = tabs.slice(0, index + 1)
    const update = {
      tabs
    }
    if (!_.some(tabs, t => t.id === currentTabId)) {
      update.currentTabId = tabs[0].id
    }
    this.props.store.storeAssign(update)
  }

  renderContext () {
    const { tabs, tab } = this.props
    const len = tabs.length
    const index = _.findIndex(tabs, t => t.id === tab.id)
    const nother = len === 1
    const noRight = index >= len - 1
    const cls = 'pd2x pd1y context-item pointer'
    const isSshConfig = tab.type === terminalSshConfigType
    return (
      <div>
        <div
          className={cls}
          onClick={this.close}
        >
          <CloseOutlined /> {e('close')} ({ctrlOrCmd} + W)
        </div>
        {
          nother
            ? null
            : (
              <div
                className={cls}
                onClick={this.closeOther}
              >
                <CloseOutlined /> {e('closeOtherTabs')}
              </div>
            )
        }
        {
          noRight
            ? null
            : (
              <div
                className={cls}
                onClick={this.closeTabsRight}
              >
                <CloseOutlined /> {e('closeTabRight')}
              </div>
            )
        }

        <div
          className={cls}
          onClick={() => this.props.store.addTab()}
        >
          <CodeOutlined /> {e('newTab')}
        </div>
        <div
          className={cls}
          onClick={this.dup}
        >
          <CopyOutlined /> {e('duplicate')}
        </div>
        <div
          className={cls + (isSshConfig ? ' disabled' : '')}
          onClick={isSshConfig ? _.noop : this.doRename}
        >
          <EditOutlined /> {e('rename')}
        </div>
        <div
          className={cls}
          onClick={this.reloadTab}
        >
          <Loading3QuartersOutlined /> {m('reload')}
        </div>
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    const { target } = e
    const rect = target.getBoundingClientRect()
    const content = this.renderContext()
    this.props.store.openContextMenu({
      content,
      pos: {
        left: rect.left,
        top: rect.top + 20
      }
    })
  }

  renderEditting (tab, cls) {
    const {
      titleTemp
    } = tab
    return (
      <div className={cls + ' pd1x'}>
        <Input
          value={titleTemp}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onPressEnter={this.onBlur}
        />
      </div>
    )
  }

  render () {
    const {
      currentTabId,
      onChangeTabId,
      onDuplicateTab
    } = this.props.store
    const { tab, terminalOnData } = this.state
    const { id, isEditting, status, isTransporting } = tab
    const active = id === currentTabId
    const cls = classnames(
      'tab',
      { active },
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
          {..._.pick(this, [
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
            onClick={() => onChangeTabId(id)}
            onDoubleClick={() => onDuplicateTab(tab)}
            onContextMenu={this.onContextMenu}
          >
            <Loading3QuartersOutlined
              className='pointer tab-reload mg1r'
              onClick={this.reloadTab}
              title={m('reload')} />
            {title}
          </div>
          <div className={'tab-status ' + status} />
          <div className='tab-traffic' />
          <BorderlessTableOutlined className='tab-terminal-feed' />
          <span className='tab-close pointer'>
            <CloseOutlined onClick={this.close} />
          </span>
        </div>
      </Tooltip>
    )
  }
}
