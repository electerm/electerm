/**
 * batch input module
 */

import { Component } from 'react'
import {
  AutoComplete,
  Input
} from 'antd'
import {
  batchInputLsKey,
  terminalWebType,
  terminalRdpType,
  terminalVncType
} from '../../common/constants'
import TabSelect from './tab-select'
import classNames from 'classnames'
import deepCopy from 'json-deep-copy'

const e = window.translate

export default class BatchInput extends Component {
  constructor (props) {
    super(props)
    this.state = {
      cmd: '',
      open: false,
      enter: false
    }
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  handleEnter = (e) => {
    const { batchInputSelectedTabIds } = window.store
    const { cmd } = this.state
    if (!cmd.trim()) {
      return
    }
    window.store.addBatchInput(cmd)
    this.props.input(cmd, Array.from(batchInputSelectedTabIds))
    this.setState({
      cmd: '',
      open: false
    })
    e.stopPropagation()
  }

  handleChange = (v = '') => {
    let vv = v.replace(/^\d+:/, '').replace(/\n$/, '')
    if (vv === batchInputLsKey) {
      window.store.clearBatchInput()
      vv = ''
    }
    this.setState({
      cmd: vv,
      open: false
    })
  }

  handleClick = () => {
    this.setState({
      open: true
    })
    window.store.filterBatchInputSelectedTabIds()
  }

  handleBlur = () => {
    this.setState({
      open: false
    })
  }

  mapper = (v, i) => {
    return {
      value: `${i}:${v}`,
      label: v
    }
  }

  renderClear = () => {
    return {
      value: batchInputLsKey,
      label: e('clear')
    }
  }

  buildOptions = () => {
    const arr = this.props.batchInputs.map(this.mapper)
    if (arr.length) {
      return [
        ...arr,
        this.renderClear()
      ]
    }
    return []
  }

  handleMouseEnter = () => {
    clearTimeout(this.timer)
    this.setState({
      enter: true
    })
  }

  leave = () => {
    this.setState({
      enter: false
    })
  }

  handleMouseLeave = () => {
    this.timer = setTimeout(this.leave, 5000)
  }

  getTabs = () => {
    const { activeTabId } = this.props
    return deepCopy(this.props.tabs.filter(tab => {
      return tab.type !== terminalWebType &&
        tab.type !== terminalRdpType &&
        tab.type !== terminalVncType
    })).sort((a, b) => {
      // Current tab goes first
      if (a.id === activeTabId) return -1
      if (b.id === activeTabId) return 1
      return 0
    })
  }

  render () {
    const { cmd, open, enter } = this.state
    const {
      batchInputSelectedTabIds
    } = this.props
    const opts = {
      options: this.buildOptions(),
      placeholder: e('batchInput'),
      value: cmd,
      onChange: this.handleChange,
      defaultOpen: false,
      open,
      allowClear: true,
      className: 'batch-input-wrap'
    }
    const cls = classNames(
      'batch-input-outer',
      {
        'bi-show': open || enter
      }
    )
    const inputProps = {
      size: 'small',
      placeholder: e('batchInput'),
      className: 'batch-input-holder'
    }
    const tabSelectProps = {
      activeTabId: this.props.activeTabId,
      tabs: this.getTabs(),
      selectedTabIds: batchInputSelectedTabIds,
      onSelectAll: window.store.selectAllBatchInputTabs,
      onSelectNone: window.store.selectNoneBatchInputTabs,
      onSelect: window.store.onSelectBatchInputSelectedTabId
    }
    return (
      <span
        className={cls}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <span className='bi-compact'>
          <Input
            {...inputProps}
          />
        </span>
        <span className='bi-full'>
          <AutoComplete
            {...opts}
          >
            <Input.TextArea
              onPressEnter={this.handleEnter}
              onClick={this.handleClick}
              onBlur={this.handleBlur}
              size='small'
              autoSize={{ minRows: 1 }}
            />
          </AutoComplete>
          <TabSelect {...tabSelectProps} />
        </span>
      </span>
    )
  }
}
