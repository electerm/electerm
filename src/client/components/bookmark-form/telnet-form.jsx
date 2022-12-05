/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import TelnetFormUi from './telnet-form-ui'

export default class TelnetForm extends BookmarkForm {
  render () {
    return (
      <TelnetFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
