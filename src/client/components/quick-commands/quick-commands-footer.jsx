/**
 * quick commands footer selection
 */

import { Component } from '../common/react-subx'
import _ from 'lodash'
import { Select } from 'antd'

const { Option } = Select

export default class QuickCommandsFooter extends Component {
  state = {
    open: true
  }

  onSelect = (id) => {
    this.setState({
      open: false
    })
  }

  render () {
    const { currentTab, quickCommands } = this.props.store
    const currentTabQuickCommands = _.get(
      currentTab, 'quickCommands'
    ) || []
    const all = [
      ...currentTabQuickCommands,
      ...quickCommands
    ]
    return (
      <div className='footer-item footer-item-left footer-qcs'>
        <Select
          open={this.state.open}
          onMouseEnter={() => this.setState({
            open: true
          })}
          onSelect={this.onSelect}
        >
          {
            all.map(qc => {
              return (
                <Option value={qc.id}>
                  {qc.name}
                </Option>
              )
            })
          }
        </Select>
      </div>
    )
  }
}
