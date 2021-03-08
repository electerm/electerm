/**
 * batch input module
 */

import { Component } from '../common/react-subx'
import {
  AutoComplete,
  Input,
  Switch,
  Tooltip
} from 'antd'

const { prefix } = window
const e = prefix('ssh')

export default class BatchInput extends Component {
  state = {
    cmd: '',
    toAll: false,
    open: false
  }

  handleEnter = (e) => {
    const { cmd, toAll } = this.state
    if (!cmd.trim()) {
      return
    }
    this.props.store.addBatchInput(cmd)
    this.props.input(cmd, toAll)
    this.setState({
      cmd: '',
      open: false
    })
    e.stopPropagation()
  }

  handleChange = (v) => {
    const vv = v.replace(/^\d+:/, '')
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

  render () {
    const { cmd, open, toAll } = this.state
    const opts = {
      options: this.props.store.batchInputs.map(this.mapper),
      placeholder: e('batchInput'),
      value: cmd,
      onChange: this.handleChange,
      defaultOpen: false,
      open,
      allowClear: true,
      className: 'batch-input-wrap'
    }
    return (
      <span>
        <AutoComplete
          {...opts}
        >
          <Input
            onPressEnter={this.handleEnter}
            onClick={this.handleClick}
            onBlur={this.handleBlur}
            size='small'
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
    )
  }
}
