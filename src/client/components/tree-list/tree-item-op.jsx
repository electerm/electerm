import {
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  RightSquareOutlined
} from '@ant-design/icons'
import {
  Popconfirm,
  Tooltip
} from 'antd'
import { useState } from 'react'
import {
  defaultBookmarkGroupId
} from '../../common/constants'

const e = window.translate

export default function TreeItemOp (props) {
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null)
  const {
    item,
    isGroup,
    staticList,
    del,
    openAll,
    openMoveModal,
    editItem,
    addSubCat,
    duplicateItem
  } = props

  if (!item) {
    return null
  }

  const isDefaultGroup = item.id === defaultBookmarkGroupId
  const canShowSharedOps = !staticList && !isDefaultGroup

  const handleDel = (event) => {
    del(pendingDeleteItem || item, event)
    setPendingDeleteItem(null)
  }

  const handleDeleteOpenChange = (open) => {
    setPendingDeleteItem(open ? item : null)
  }

  const handleOpenMoveModal = (event) => {
    openMoveModal(event, item, isGroup)
  }

  const handleEditItem = (event) => {
    editItem(event, item, isGroup)
  }

  const handleAddSubCat = (event) => {
    addSubCat(event, item)
  }

  const handleDuplicateItem = (event) => {
    duplicateItem(event, item)
  }

  const handleOpenAll = () => {
    openAll(item)
  }

  const buttons = []

  if (isGroup && !staticList) {
    buttons.push(
      <FolderAddOutlined
        key='new-tree'
        title={`${e('new')} ${e('bookmarkCategory')}`}
        onClick={handleAddSubCat}
        className='pointer tree-control-btn'
      />
    )
  }

  if (isGroup && staticList) {
    buttons.push(
      <Tooltip title={e('openAll')} key='open-all-tooltip'>
        <FolderOpenOutlined
          key='open-all-tree'
          onClick={handleOpenAll}
          className='pointer open-all-icon tree-control-btn'
        />
      </Tooltip>
    )
  }

  if (!isGroup && !staticList && item.id) {
    buttons.push(
      <CopyOutlined
        key='duplicate-tree'
        title={e('duplicate')}
        className='pointer tree-control-btn'
        onClick={handleDuplicateItem}
      />
    )
  }

  if (canShowSharedOps) {
    buttons.push(
      <RightSquareOutlined
        key='move-tree'
        className='pointer tree-control-btn'
        onClick={handleOpenMoveModal}
      />
    )
  }

  if (!isDefaultGroup && !staticList) {
    buttons.push(
      <Popconfirm
        key='delete-tree'
        title={e('del') + '?'}
        onConfirm={handleDel}
        onCancel={() => setPendingDeleteItem(null)}
        onOpenChange={handleDeleteOpenChange}
        okText={e('del')}
        cancelText={e('cancel')}
        placement='top'
      >
        <CloseOutlined title={e('del')} className='pointer tree-control-btn' />
      </Popconfirm>
    )
  }

  const shouldShowEdit = !((staticList && isGroup) || (!staticList && !isGroup))
  if (shouldShowEdit) {
    buttons.push(
      <EditOutlined
        title={e('edit')}
        key='edit-tree'
        onClick={handleEditItem}
        className='pointer edit-icon tree-control-btn'
      />
    )
  }

  if (!buttons.length) {
    return null
  }

  return (
    <div
      className={`tree-item-op-wrap${pendingDeleteItem ? ' is-active' : ''}`}
    >
      {buttons}
    </div>
  )
}
