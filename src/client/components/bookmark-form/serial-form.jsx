/**
 * bookmark form
 */
import BookmarkForm from './ssh-form'
import SerialFormUi from './serial-form-ui'

export default class SerialForm extends BookmarkForm {
  componentDidMount () {
    this.props.store.handleGetSerials()
  }

  render () {
    return (
      <SerialFormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
