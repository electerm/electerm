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
    cmd: ''
  }

  handleEnter = () => {
    const { cmd } = this.state
    this.props.store.addBatchInput(cmd)
    this.props.input(cmd)
    this.setState({
      cmd: ''
    })
  }

  handleChange = (v) => {
    this.setState({
      cmd: v
    })
  }

  render () {
    const { cmd } = this.state

    return (
      <AutoComplete
        dataSource={this.props.store.batchInputs}
        placeholder={e('batchInput')}
        value={cmd}
        onChange={this.handleChange}
        size='small'
        defaultOpen={false}
        allowClear
      >
        <Input
          onPressEnter={this.handleEnter}
          size='small'
        />
      </AutoComplete>
    )
  }
}
