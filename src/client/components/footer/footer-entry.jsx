import { Component } from '../common/react-subx'
import './footer.styl'

export default class SystemMenu extends Component {
  renderBatchInputs () {
    return (
      <div className='terminal-footer-unit terminal-footer-center'>
        <BatchInput
          store={this.props.store}
          input={this.batchInput}
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
            defaultValue={this.props.tab.encode}
            onSelect={this.switchEncoding}
            size='small'
          >
            {
              encodes.map(k => {
                return (
                  <Select.Option key={k} value={k}>
                    {k}
                  </Select.Option>
                )
              })
            }
          </Select>
        </div>
      </div>
    )
  }

  renderInfoIcon () {
    const { loading } = this.state
    const infoProps = {
      showInfoPanel: this.handleShowInfo
    }
    return loading || !this.isActiveTerminal()
      ? null
      : (
        <div className='terminal-footer-unit terminal-footer-info'>
          <TerminalInfoIcon
            {...infoProps}
          />
        </div>
      )
  }

  render () {
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
