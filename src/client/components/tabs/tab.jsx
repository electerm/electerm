/**
 * file section
 */

import React from 'react'
import {Icon, Tooltip, message, Badge} from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import wait from '../../common/wait'
import createName from '../../common/create-title'
import {addClass, removeClass} from '../../common/class'
import {generate} from 'shortid'
import {
  statusMap, terminalSshConfigType
} from '../../common/constants'

const {prefix} = window
const e = prefix('tabs')
const m = prefix('menu')
const onDragCls = 'ondrag-tab'
const onDragOverCls = 'dragover-tab'

export default class Tab extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      tab: copy(props.tab)
    }
  }

  componentDidMount() {
    this.dom = document.getElementById('id' + this.state.tab.id)
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.tab, this.props.tab)) {
      this.setState({
        tab: copy(nextProps.tab)
      })
    }
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
    //debug('ondragexit')
    //let {target} = e
    //removeClass(target, 'sftp-dragover')
  }

  onDragLeave = e => {
    //debug('ondragleave')
    let {target} = e
    removeClass(target, onDragOverCls)
  }

  onDragOver = e => {
    //debug('ondragover')
    //debug(e.target)
    //removeClass(this.dom, 'sftp-dragover')
    e.preventDefault()
  }

  onDragStart = e => {
    //debug('ondragstart')
    //debug(e.target)
    e.dataTransfer.setData('fromFile', JSON.stringify(this.state.tab))
    //e.effectAllowed = 'copyMove'
  }

  onDrop = e => {
    e.preventDefault()
    let {target} = e
    if (!target) {
      return
    }
    // debug('target drop', target)
    let fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
    let onDropTab = document.querySelector('.' + onDragOverCls)
    if (!onDropTab || !fromTab) {
      return
    }
    let dropId = onDropTab.getAttribute('data-id')
    if (!dropId || dropId === fromTab.id) {
      return
    }
    let {id} = fromTab
    let tabs = copy(this.props.tabs)
    let indexFrom = _.findIndex(tabs, t => t.id === id)
    let indexDrop = _.findIndex(tabs, t => t.id === dropId)
    if (indexDrop > indexFrom) {
      indexDrop = indexDrop - 1
    }
    tabs.splice(indexFrom, 1)
    tabs.splice(indexDrop, 0, fromTab)
    this.props.modifier({
      tabs
    })
  }

  reloadTab = async () => {
    let tab = copy(
      this.state.tab
    )
    let {id} = tab
    tab.id = generate()
    tab.status = statusMap.processing
    let tabs = copy(this.props.tabs)
    let index = _.findIndex(tabs, t => t.id === id)
    this.props.delTab({id: this.state.tab.id})
    await wait(30)
    this.props.addTab(tab, index)
  }

  onDragEnd = e => {
    removeClass(this.dom, onDragCls)
    this.clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }

  close = () => {
    this.props.delTab({id: this.state.tab.id})
    if (this.props.tabs.length <= 1) {
      setTimeout(this.props.addTab, 1)
    }
  }

  dup = () => {
    this.props.onDuplicateTab(this.props.tab)
  }

  doRename = () => {
    let tab = copy(this.state.tab)
    tab.titleTemp = tab.title || ''
    tab.isEditting = true
    this.setState({
      tab
    })
  }

  onBlur = () => {
    let tab = copy(this.state.tab)
    let {titleTemp, title, id, host} = tab
    if (!titleTemp && !host) {
      return message.warn(e('titleEmptyWarn'))
    }
    if (title === titleTemp) {
      delete tab.titleTemp
      delete tab.isEditting
      return this.setState({
        tab
      })
    }
    this.props.editTab(id, {title: titleTemp})
  }

  onChange = e => {
    let titleTemp = e.target.value
    let tab = copy(this.state.tab)
    tab.titleTemp = titleTemp
    this.setState({
      tab
    })
  }

  closeOther = () => {
    this.props.modifier({
      tabs: [this.props.tab],
      currentTabId: this.props.tab.id
    })
  }

  closeTabsRight = () => {
    let {tabs, tab, currentTabId} = this.props
    let index = _.findIndex(tabs, t => t.id === tab.id)
    tabs = tabs.slice(0, index + 1)
    let update = {
      tabs
    }
    if (!_.some(tabs, t => t.id === currentTabId)) {
      update.currentTabId = tabs[0].id
    }
    this.props.modifier(update)
  }

  renderContext() {
    let {tabs, tab} = this.props
    let len = tabs.length
    let index = _.findIndex(tabs, t => t.id === tab.id)
    let nother = len === 1
    let noRight = index >= len - 1
    let cls = 'pd2x pd1y context-item pointer'
    let isSshConfig = tab.type === terminalSshConfigType
    return (
      <div>
        <div
          className={cls}
          onClick={this.close}
        >
          <Icon type="close" /> {e('close')}
        </div>
        {
          nother
            ? null
            : (
              <div
                className={cls}
                onClick={this.closeOther}
              >
                <Icon type="close" /> {e('closeOtherTabs')}
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
                <Icon type="close" /> {e('closeTabRight')}
              </div>
            )
        }

        <div
          className={cls}
          onClick={() => this.props.addTab()}
        >
          <Icon type="code-o" /> {e('newTab')}
        </div>
        <div
          className={cls}
          onClick={this.dup}
        >
          <Icon type="copy" /> {e('duplicate')}
        </div>
        <div
          className={cls + (isSshConfig ? ' disabled' : '')}
          onClick={isSshConfig ? _.noop : this.doRename}
        >
          <Icon type="edit" /> {e('rename')}
        </div>
        <div
          className={cls}
          onClick={this.reloadTab}
        >
          <Icon type="loading-3-quarters" theme="outlined" /> {m('reload')}
        </div>
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    let {target} = e
    let rect = target.getBoundingClientRect()
    let content = this.renderContext()
    this.props.openContextMenu({
      content,
      pos: {
        left: rect.left,
        top: rect.top + 20
      }
    })
  }

  renderEditting(tab, cls) {
    let {
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

  render() {
    let {
      currentTabId,
      onChangeTabId,
      onDuplicateTab
    } = this.props
    let {tab} = this.state
    let {id, isEditting, status} = tab
    let active = id === currentTabId
    let cls = classnames('tab', {active}, status)
    let title = createName(tab)
    if (isEditting) {
      return this.renderEditting(tab, cls)
    }
    return (
      <Tooltip
        title={title}
        placement="top"
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
            className="tab-title elli pd1x"
            onClick={() => onChangeTabId(id)}
            onDoubleClick={() => onDuplicateTab(tab)}
            onContextMenu={this.onContextMenu}
          >
            <Badge status={status} />
            <Icon
              className="pointer tab-reload mg1r"
              type="loading-3-quarters"
              theme="outlined"
              onClick={this.reloadTab}
              title={m('reload')}
            />
            {title}
          </div>
          <Icon
            className="pointer tab-close"
            type="close-circle"
            theme="filled"
            onClick={this.close}
          />
        </div>
      </Tooltip>
    )
  }
}
