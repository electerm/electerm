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
      title='?'
      open={visible}
      onCancel={onCancel}
      footer={
        <div className='custom-modal-footer-buttons'>
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
