import ProfileTransportMod from './profile-transport-mod'
import { Component } from '../common/react-subx'

export default class ProfileTransport extends Component {
  render () {
    return (
      <div className='pd1b'>
        <ProfileTransportMod store={this.props.store} />
      </div>
    )
  }
}
