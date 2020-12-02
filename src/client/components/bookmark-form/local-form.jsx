/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import LocalFormUi from './local-form-ui'

export default class LocalForm extends BookmarkForm {
  componentDidMount () {
    this.props.store.getSerials()
  }

  render () {
    return (
      <LocalFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
