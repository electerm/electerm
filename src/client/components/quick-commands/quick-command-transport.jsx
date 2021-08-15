import QmTransportMod from './quick-command-transport-mod'
import { Component } from '../common/react-subx'

export default class QmTransport extends Component {
  render () {
    return (
      <div className='pd1b'>
        <QmTransportMod store={this.props.store} />
      </div>
    )
  }
}
