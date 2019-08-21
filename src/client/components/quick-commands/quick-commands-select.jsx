/**
 * quick commands footer selection
 */

import { Component } from '../common/react-subx'
import _ from 'lodash'
import { Select } from 'antd'
import copy from 'json-deep-copy'
import './quick-commands.styl'

const { Option } = Select
const { prefix } = window
const e = prefix('quickCommands')
const addQuickCommands = 'addQuickCommands'

export default class QuickCommandsFooter extends Component {
  onSelect = (id) => {
    if (id === addQuickCommands) {
      this.props.store.openQuickCommandsSetting()
    } else {
      const qm = _.find(
        this.props.store.currentQuickCommands,
        a => a.id === id
      )
      if (qm && qm.command) {
        window.postMessage({
          action: 'quick-command',
          command: qm.command
        }, '*')
      }
    }
  }

  render () {
    const all = copy(this.props.store.currentQuickCommands)
    if (!all.length) {
      all.push({
        id: addQuickCommands,
        name: e(addQuickCommands)
      })
    }
    return (
      <div className='fleft'>
        <Select
          style={{
            width: 200
          }}
          value={undefined}
          placeholder={e('quickCommands')}
          onSelect={this.onSelect}
          size='small'
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
