/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import RdpFormUi from './rdp-form-ui'

export default class RdpForm extends BookmarkForm {
  render () {
    return (
      <RdpFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
