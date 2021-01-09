/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import LocalFormUi from './local-form-ui'

export default class LocalForm extends BookmarkForm {
  render () {
    return (
      <LocalFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
