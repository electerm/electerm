import { Component } from 'react'
import Modal from '../common/modal'

const e = window.translate

export class DropFileModal extends Component {
  renderSerialFooter () {
    const { onSelect } = this.props
    return (
      <>
        <button
          type='button'
          className='custom-modal-ok-btn'
          onClick={() => onSelect('xmodem')}
        >
          XMODEM
        </button>
        <button
          type='button'
          className='custom-modal-cancel-btn'
          onClick={() => onSelect('inputOnly')}
        >
          {e('inputOnly')}
        </button>
      </>
    )
  }

  renderSshFooter () {
    const { onSelect } = this.props
    return (
      <>
        <button
          type='button'
          className='custom-modal-ok-btn'
          onClick={() => onSelect('trz')}
        >
          trz
        </button>
        <button
          type='button'
          className='custom-modal-cancel-btn'
          onClick={() => onSelect('rz')}
        >
          rz
        </button>
        <button
          type='button'
          className='custom-modal-cancel-btn'
          onClick={() => onSelect('inputOnly')}
        >
          {e('inputOnly')}
        </button>
      </>
    )
  }

  render () {
    const {
      visible,
      files,
      isSerial,
      onCancel
    } = this.props

    if (!visible) {
      return null
    }

    return (
      <Modal
        title='?'
        open={visible}
        onCancel={onCancel}
        footer={
          <div className='custom-modal-footer-buttons'>
            {isSerial ? this.renderSerialFooter() : this.renderSshFooter()}
          </div>
        }
        width={400}
      >
        <p>{files?.map(f => f.path).join(', ')}</p>
      </Modal>
    )
  }
}

export default DropFileModal
