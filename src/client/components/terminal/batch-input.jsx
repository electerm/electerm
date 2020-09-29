/**
 * batch input module
 */

import { Component } from '../common/react-subx'
import {
  AutoComplete,
  Input
} from 'antd'

const { prefix } = window
const e = prefix('ssh')

export default class BatchInput extends Component {
  state = {
    cmd: '',
    open: false
  }

  handleEnter = (e) => {
    const { cmd } = this.state
    this.props.store.addBatchInput(cmd)
    this.props.input(cmd)
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

  render () {
    const { cmd, open } = this.state

    return (
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
    )
  }
}
