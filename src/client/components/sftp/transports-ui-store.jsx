/**
 * transporter UI component
 */
import { Component } from '../common/react-subx'
import Transport from './transport-action-store'

export default class TransportsUI extends Component {
  render () {
    const { store } = this.props
    const {
      fileTransfers
    } = store
    if (!fileTransfers.length) {
      return null
    }
    return fileTransfers.map((t, i) => {
      const { id } = t
      return (
        <Transport
          {...this.props}
          transfer={t}
          inited={t.inited}
          cancel={t.cancel}
          pause={t.pausing}
          key={id + ':tr:' + i}
        />
      )
    })
  }
}
