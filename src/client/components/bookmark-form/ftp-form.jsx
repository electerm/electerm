/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import FtpFormUi from './ftp-form-ui'

export default class FtpForm extends BookmarkForm {
  render () {
    return (
      <FtpFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
