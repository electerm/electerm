// render bookmark select, use antd tree select
import { useState } from 'react'
import buildGroupData from '../bookmark-form/bookmark-group-tree-format'
import { TreeSelect, Modal, Button } from 'antd'
const e = window.translate

export default function MoveItemModal (props) {
  const [groupId, setGroupId] = useState('')
  const {
    openMoveModal,
    moveItem,
    moveItemIsGroup
  } = props
  const { bookmarkGroups } = window.store
  const [data, groupMap] = buildGroupData(bookmarkGroups, moveItem.id, true)
  function onSelect () {
    const group = groupMap.get(groupId)
    if (!group) {
      return
    }
    if (moveItemIsGroup) {
      group.bookmarkGroupIds = [
        ...(group.bookmarkGroupIds || []),
        moveItem.id
      ]
    } else {
      group.bookmarkIds = [
        ...(group.bookmarkIds || []),
        moveItem.id
      ]
    }
    props.onCancel()
  }
  const modalProps = {
    open: openMoveModal,
    title: e('moveTo'),
    footer: null,
    onCancel: props.onCancel
  }
  if (!openMoveModal) {
    return null
  }
  return (
    <Modal {...modalProps}>
      <div>
        <div className='pd1'>
          <h3>{e('moveTo')}</h3>
        </div>
        <div className='pd1'>
          <TreeSelect
            treeData={data}
            onChange={setGroupId}
            placeholder={e('bookmarks')}
            showSearch
            value={groupId}
          />
        </div>
        <div className='pd1'>
          <Button
            type='primary'
            onClick={onSelect}
            disabled={!groupId}
          >
            {e('ok')}
          </Button>
          <Button
            onClick={props.onCancel}
            className='mg1l'
          >
            {e('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
