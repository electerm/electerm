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
    this.setState({
      cmd: v,
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

  render () {
    const { cmd, open, toAll } = this.state

    return (
      <span>
        <AutoComplete
          dataSource={this.props.store.batchInputs}
          placeholder={e('batchInput')}
          value={cmd}
          onChange={this.handleChange}
          size='small'
          defaultOpen={false}
          open={open}
          allowClear
        >
          <Input
            onPressEnter={this.handleEnter}
            onClick={this.handleClick}
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
