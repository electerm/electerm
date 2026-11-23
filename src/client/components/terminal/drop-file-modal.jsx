import { useState } from 'react'
import { Select } from 'antd'
import { FileOutlined } from '@ant-design/icons'
import { getItem, setItem } from '../../common/safe-local-storage'
import { terminalDropOptions } from '../../common/terminal-drop-uploads'
import Modal from '../common/modal'
import './drop-file-modal.styl'

const e = window.translate

export default function DropFileModal ({ files, isSerial, onSelect, onCancel }) {
  const options = terminalDropOptions(e, isSerial)
  const storageKey = isSerial ? 'lastSerialDropAction' : 'lastSshDropAction'
  const [action, setAction] = useState(() => {
    const saved = getItem(storageKey)
    return options.some(option => option.value === saved) ? saved : 'inputOnly'
  })

  function confirm () {
    setItem(storageKey, action)
    onSelect(action)
  }

  return (
    <Modal
      title={e('dragDropBehavior')}
      open
      onCancel={onCancel}
      className='drop-file-modal'
      width={400}
      footer={
        <button type='button' className='custom-modal-ok-btn' onClick={confirm}>
          {e('ok')}
        </button>
      }
    >
      <ul className='drop-file-list'>
        {files?.map(file => (
          <li key={file.path}><FileOutlined /><span>{file.path}</span></li>
        ))}
      </ul>
      <div onKeyDown={event => {
        // The modal also handles Enter and Space as confirmation shortcuts.
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
      }}
      >
        <Select
          aria-label={e('dragDropBehavior')}
          value={action}
          options={options}
          onChange={setAction}
          getPopupContainer={trigger => trigger.parentElement}
        />
      </div>
    </Modal>
  )
}
