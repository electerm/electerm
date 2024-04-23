/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import WebFormUi from './web-form-ui'

export default class WebForm extends BookmarkForm {
  render () {
    return (
      <WebFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
