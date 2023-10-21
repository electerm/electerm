/**
 * batch input module
 */

import { Component } from 'react'
import {
  AutoComplete,
  Input,
  Switch,
  Tooltip
} from 'antd'
import { batchInputLsKey, commonActions } from '../../common/constants'
import postMsg from '../../common/post-msg'
import classNames from 'classnames'

const { prefix } = window
const e = prefix('ssh')

export default class BatchInput extends Component {
  state = {
    cmd: '',
    toAll: false,
    open: false,
    enter: false
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  handleEnter = (e) => {
    const { cmd, toAll } = this.state
    if (!cmd.trim()) {
      return
    }
    window.store.addBatchInput(cmd)
    this.props.input(cmd, toAll)
    this.setState({
      cmd: '',
      open: false
    })
    e.stopPropagation()
  }

  handleChange = (v = '') => {
    let vv = v.replace(/^\d+:/, '').replace(/\n$/, '')
    if (vv === batchInputLsKey) {
      postMsg({
        action: commonActions.updateStore,
        func: 'clearBatchInput'
      })
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
  }

  handleChangeAll = toAll => {
    this.setState({
      toAll
    })
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

  render () {
    const { cmd, open, toAll, enter } = this.state
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
              row={1}
            />
          </AutoComplete>
          <Tooltip title={e('runInAllTerminals')}>
            <Switch
              className='mg1l'
              checked={toAll}
              onChange={this.handleChangeAll}
            />
          </Tooltip>
        </span>
      </span>
    )
  }
}
