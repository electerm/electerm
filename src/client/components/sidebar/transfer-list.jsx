import { Component } from '../common/react-subx'

export default class TransferList extends Component {
  render () {
    const {
      fileTransfers
    } = this.props.store
    if (!fileTransfers.length) {
      return null
    }
  }
}
