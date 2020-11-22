/**
 * quick commands footer selection
 */

import { Component } from '../common/react-subx'
import _ from 'lodash'
import { Select } from 'antd'
import copy from 'json-deep-copy'

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
          command: qm.command,
          inputOnly: qm.inputOnly
        }, '*')
      }
    }
  }

  filterFunc = (v, opt) => {
    const c = opt.props.children.toLowerCase()
    const m = opt.props.cmd.toLowerCase()
    const vv = v.toLowerCase()
    return c.includes(vv) || m.includes(vv)
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
      <div className='fleft relative'>
        <Select
          style={{
            width: 200
          }}
          value={undefined}
          placeholder={e('quickCommands')}
          onSelect={this.onSelect}
          autoFocus
          size='small'
          showSearch
          optionFilterProp='children'
          filterOption={this.filterFunc}
        >
          {
            all.map((qc, i) => {
              return (
                <Option key={qc.id + '-' + i} value={qc.id} cmd={qc.command}>
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
