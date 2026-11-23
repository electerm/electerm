import { terminalDropUploads, dropUploadLabel } from '../../common/terminal-drop-uploads'
import Modal from '../common/modal'

const e = window.translate

export function DropFileModal (props) {
  const {
    visible,
    files,
    isSerial,
    onSelect,
    onCancel
  } = props

  const renderSerialFooter = () => {
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

  const renderSshFooter = () => {
    return (
      <>
        {terminalDropUploads.map(upload => (
          <button
            key={upload.command}
            type='button'
            className='custom-modal-cancel-btn'
            onClick={() => onSelect(upload.command)}
          >
            {dropUploadLabel(upload, e)}
          </button>
        ))}
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

  const renderList = () => {
    return (
      <ul>
        {files?.map(f => (
          <li key={f.path}>{f.path}</li>
        ))}
      </ul>
    )
  }

  if (!visible) {
    return null
  }

  return (
    <Modal
      title={e('dragDropBehavior')}
      open={visible}
      onCancel={onCancel}
      footer={
        <div className='custom-modal-footer-buttons' style={{ flexWrap: 'wrap' }}>
          {isSerial ? renderSerialFooter() : renderSshFooter()}
        </div>
      }
      width={400}
    >
      {renderList()}
    </Modal>
  )
}

export default DropFileModal
