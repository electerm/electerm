import { Component } from 'react'
import Modal from '../common/modal'

const e = window.translate

export class DropFileModal extends Component {
  render () {
    const {
      visible,
      files,
      onSelect,
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
            <button
              type='button'
              className='custom-modal-ok-btn'
              onClick={() => onSelect('trzUpload')}
            >
              trz
            </button>
            <button
              type='button'
              className='custom-modal-cancel-btn'
              onClick={() => onSelect('rzUpload')}
            >
              rz
            </button>
            <button
              type='button'
              className='custom-modal-cancel-btn'
              onClick={() => onSelect('inputPath')}
            >
              {e('inputOnly')}
            </button>
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
