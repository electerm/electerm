/**
 * file section
 */

import React from 'react'
import {Icon, Tooltip, message, Badge} from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import createName from '../../common/create-title'

export default class Tab extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      tab: copy(props.tab)
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.tab, this.props.tab)) {
      this.setState({
        tab: copy(nextProps.tab)
      })
    }
  }

  close = () => {
    this.props.onClose(this.state.tab.id)
    if (this.props.tabs.length <= 1) {
      setTimeout(this.add, 1)
    }
    this.props.closeContextMenu()
  }

  dup = () => {
    this.props.onDup(this.props.tab)
    this.props.closeContextMenu()
  }

  add = () => {
    this.props.onAdd()
    this.props.closeContextMenu()
  }

  doRename = () => {
    let tab = copy(this.state.tab)
    tab.titleTemp = tab.title || ''
    tab.isEditting = true
    this.props.closeContextMenu()
    this.setState({
      tab
    })
  }

  onBlur = () => {
    let tab = copy(this.state.tab)
    let {titleTemp, title, id, host} = tab
    if (!titleTemp && !host) {
      return message.warn('title can not be empty')
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
    this.props.closeContextMenu()
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
    this.props.closeContextMenu()
  }

  renderContext() {
    let {tabs, tab} = this.props
    let len = tabs.length
    let index = _.findIndex(tabs, t => t.id === tab.id)
    let nother = len === 1
    let noRight = index >= len - 1
    let cls = 'pd2x pd1y context-item pointer'
    return (
      <div>
        <div
          className={cls}
          onClick={this.close}
        >
          <Icon type="close" /> close
        </div>
        {
          nother
            ? null
            : (
              <div
                className={cls}
                onClick={this.closeOther}
              >
                <Icon type="close" /> close other tabs
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
                <Icon type="close" /> close tabs on the right
              </div>
            )
        }

        <div
          className={cls}
          onClick={this.add}
        >
          <Icon type="code-o" /> new tab
        </div>
        <div
          className={cls}
          onClick={this.dup}
        >
          <Icon type="copy" /> duplicate
        </div>
        <div
          className={cls}
          onClick={this.doRename}
        >
          <Icon type="edit" /> rename
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
      <div className={cls + 'pd1x'}>
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
      onChange,
      onDup
    } = this.props
    let {tab} = this.state
    let {id, isEditting, status} = tab
    let active = id === currentTabId
    let cls = classnames('tab', {active})
    let title = createName(tab)
    if (isEditting) {
      return this.renderEditting(tab, cls)
    }
    return (
      <Tooltip
        title={title}
        placement="top"
      >
        <div className={cls}>
          <div
            className="tab-title elli pd1x"
            onClick={() => onChange(id)}
            onDoubleClick={() => onDup(tab)}
            onContextMenu={this.onContextMenu}
          >
            <Badge status={status} />
            {title}
          </div>
          <Icon
            className="pointer tab-close"
            type="close-circle"
            onClick={this.close}
          />
        </div>
      </Tooltip>
    )
  }
}
