/**
 * batch input module
 *
 * Unified click-to-open behavior for mobile and desktop:
 *   - click the compact trigger -> expand the textarea + tab-select panel
 *   - click outside the panel    -> collapse it
 *   - press Enter in the textarea -> send `cmd` to all selected tabs
 *
 * On desktop the compact trigger is rendered as a read-only Input that only
 * serves as a clickable affordance — it is never a real input. On mobile it
 * is a small "B" button to save horizontal space. The open/close logic is
 * identical for both.
 */

import { Component, createRef } from 'react'
import {
  Button,
  Input
} from 'antd'
import {
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
      open: false
    }
    this.outerRef = createRef()
    this.textAreaRef = createRef()
  }

  componentDidMount () {
    document.addEventListener('mousedown', this.handleDocClick)
  }

  componentWillUnmount () {
    document.removeEventListener('mousedown', this.handleDocClick)
  }

  // Collapse the panel when the user clicks anywhere outside of it.
  // Clicks inside an antd Popover (e.g. the tab-select popover, which renders
  // in a portal outside this node) are treated as "inside" so interacting with
  // tab selection does not collapse the panel.
  handleDocClick = (ev) => {
    if (!this.state.open) {
      return
    }
    const node = this.outerRef.current
    if (node && node.contains(ev.target)) {
      return
    }
    if (ev.target && ev.target.closest && ev.target.closest('.ant-popover')) {
      return
    }
    this.setState({ open: false })
  }

  handleToggle = () => {
    const willOpen = !this.state.open
    if (willOpen) {
      window.store.filterBatchInputSelectedTabIds()
    }
    this.setState({ open: willOpen }, () => {
      if (willOpen && this.textAreaRef.current) {
        this.textAreaRef.current.focus()
      }
    })
  }

  handleSubmit = (ev) => {
    const { batchInputSelectedTabIds } = this.props
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
    ev?.stopPropagation()
  }

  handleChange = (ev) => {
    this.setState({
      cmd: ev.target.value
    })
  }

  getTabs = () => {
    const { activeTabId } = this.props
    return deepCopy(this.props.tabs.filter(tab => {
      return tab.type !== terminalWebType &&
        tab.type !== terminalRdpType &&
        tab.type !== terminalVncType
    })).sort((a, b) => {
      // current tab goes first
      if (a.id === activeTabId) return -1
      if (b.id === activeTabId) return 1
      return 0
    })
  }

  renderTrigger () {
    const { isMobile } = this.props
    if (isMobile) {
      return (
        <Button
          size='small'
          type='text'
          onClick={this.handleToggle}
        >
          B
        </Button>
      )
    }
    // Desktop: an input-shaped, read-only affordance. It is NOT a real input —
    // clicking it expands the panel where the user actually types.
    return (
      <Input
        size='small'
        readOnly
        placeholder={e('batchInput')}
        className='batch-input-holder'
        style={{ cursor: 'pointer' }}
        onClick={this.handleToggle}
      />
    )
  }

  render () {
    const { open } = this.state
    const { batchInputSelectedTabIds } = this.props
    const cls = classNames(
      'batch-input-outer',
      { 'bi-show': open }
    )
    const textAreaProps = {
      ref: this.textAreaRef,
      onPressEnter: this.handleSubmit,
      onChange: this.handleChange,
      value: this.state.cmd,
      size: 'small',
      autoSize: { minRows: 2, maxRows: 6 },
      placeholder: e('batchInput'),
      allowClear: true
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
        ref={this.outerRef}
      >
        <span className='bi-compact'>
          {this.renderTrigger()}
        </span>
        <span className='bi-full'>
          <Input.TextArea
            {...textAreaProps}
          />
          <TabSelect {...tabSelectProps} />
        </span>
      </span>
    )
  }
}
