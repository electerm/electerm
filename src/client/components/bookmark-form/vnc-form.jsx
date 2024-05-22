/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import RdpFormUi from './rdp-form-ui'

export default class VncForm extends BookmarkForm {
  render () {
    return (
      <RdpFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
