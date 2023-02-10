import { Component } from '../common/react-subx'
import {
  Tooltip,
  Select
} from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import './footer.styl'
import { paneMap, terminalActions, statusMap } from '../../common/constants'
import postMessage from '../../common/post-msg'
import BatchInput from './batch-input'
import encodes from '../bookmark-form/encodes'
import Qm from '../quick-commands/quick-commands-select'

const {
  Option
} = Select

const { prefix } = window
const f = prefix('form')

export default class SystemMenu extends Component {
  showInfoPanel = () => {
    const { activeTerminalId } = this.props.store
    postMessage({
      action: terminalActions.showInfoPanel,
      activeSplitId: activeTerminalId
    })
  }

  batchInput = (cmd, toAll) => {
    const { activeTerminalId } = this.props.store
    postMessage({
      action: terminalActions.batchInput,
      activeSplitId: activeTerminalId,
      toAll,
      cmd
    })
  }

  switchEncoding = encode => {
    const { activeTerminalId } = this.props.store
    postMessage({
      encode,
      action: terminalActions.changeEncode,
      activeSplitId: activeTerminalId
    })
  }

  isLoading = () => {
    const { currentTab } = this.props.store
    if (!currentTab) {
      return true
    }
    const {
      status
    } = currentTab
    return status !== statusMap.success
  }

  renderBatchInputs () {
    return (
      <div className='terminal-footer-unit terminal-footer-center'>
        <BatchInput
          input={this.batchInput}
          batchInputs={this.props.store.batchInputs}
        />
      </div>
    )
  }

  renderQuickCommands () {
    return (
      <div className='terminal-footer-unit terminal-footer-qm'>
        <Qm
          store={this.props.store}
        />
      </div>
    )
  }

  renderEncodingInfo () {
    return (
      <div className='terminal-footer-unit terminal-footer-info'>
        <div className='fleft relative'>
          <Select
            style={{ minWidth: 100 }}
            placeholder={f('encode')}
            defaultValue={this.props.currentTab?.encode}
            onSelect={this.switchEncoding}
            size='small'
          >
            {
              encodes.map(k => {
                return (
                  <Option key={k} value={k}>
                    {k}
                  </Option>
                )
              })
            }
          </Select>
        </div>
      </div>
    )
  }

  renderInfoIcon () {
    const loading = this.isLoading()
    return loading
      ? null
      : (
        <div className='terminal-footer-unit terminal-footer-info'>
          <Tooltip
            title='Terminal Info'
          >
            <InfoCircleOutlined
              onClick={this.showInfoPanel}
              className='pointer font18 terminal-info-icon' />
          </Tooltip>
        </div>
      )
  }

  render () {
    const { tabs } = this.props.store
    const pane = this.props.store.currentTab?.pane
    if (pane === paneMap.fileManager || !tabs.length) {
      return null
    }
    return (
      <div className='main-footer'>
        <div className='terminal-footer-flex'>
          {this.renderQuickCommands()}
          {this.renderBatchInputs()}
          {this.renderEncodingInfo()}
          {this.renderInfoIcon()}
        </div>
      </div>
    )
  }
}
