/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import VncFormUi from './vnc-form-ui'

export default class VncForm extends BookmarkForm {
  render () {
    return (
      <VncFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
