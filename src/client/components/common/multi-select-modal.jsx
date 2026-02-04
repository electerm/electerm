import { useState } from 'react'
import Modal from './modal'
import BookmarkTreeSelect from '../bookmark-form/tree-select'

const e = window.translate

const MultiSelectModal = ({ onClose, open }) => {
  const [checkedKeys, setCheckedKeys] = useState([])
  const [expandedKeys, setExpandedKeys] = useState([])
  if (!open) {
    return null
  }
  const { store } = window
  return (
    <Modal
      title={e('open') + ' ' + e('bookmarks')}
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <BookmarkTreeSelect
        type='open'
        onClose={onClose}
        bookmarks={store.bookmarks}
        bookmarkGroups={store.bookmarkGroups}
        expandedKeys={expandedKeys}
        checkedKeys={checkedKeys}
        onExpand={setExpandedKeys}
        onCheck={setCheckedKeys}
      />
    </Modal>
  )
}

export default MultiSelectModal
