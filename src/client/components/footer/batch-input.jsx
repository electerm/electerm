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
import { batchInputLsKey, commonActions } from '../../common/constants'
import postMsg from '../../common/post-msg'

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
    const arr = this.props.store.batchInputs.map(this.mapper)
    if (arr.length) {
      return [
        ...arr,
        this.renderClear()
      ]
    }
    return []
  }

  render () {
    const { cmd, open, toAll } = this.state
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
    return (
      <span>
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
    )
  }
}
