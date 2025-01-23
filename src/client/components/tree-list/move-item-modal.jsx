// render bookmark select, use antd tree select
import { useState } from 'react'
import buildGroupData from '../bookmark-form/bookmark-group-tree-format'
import { TreeSelect, Modal, Button } from 'antd'
const e = window.translate

export default function MoveItemModal (props) {
  const [groupId, setGroupId] = useState(undefined)
  const {
    openMoveModal,
    moveItem,
    moveItemIsGroup,
    bookmarkGroups
  } = props
  if (!openMoveModal) {
    return null
  }
  const data = buildGroupData(bookmarkGroups, moveItem.id)
  function onSelect () {
    const {
      bookmarkGroups
    } = window.store
    const groupMap = new Map(bookmarkGroups.map(d => [d.id, d]))
    const group = groupMap.get(groupId)
    if (!group) {
      return
    }
    // Find and update the original parent group
    const currentParentGroup = bookmarkGroups.find(bg => {
      if (moveItemIsGroup) {
        return (bg.bookmarkGroupIds || []).includes(moveItem.id)
      }
      return (bg.bookmarkIds || []).includes(moveItem.id)
    })

    // Remove from original parent if found
    if (currentParentGroup) {
      if (moveItemIsGroup) {
        currentParentGroup.bookmarkGroupIds = currentParentGroup.bookmarkGroupIds.filter(
          id => id !== moveItem.id
        )
      } else {
        currentParentGroup.bookmarkIds = currentParentGroup.bookmarkIds.filter(
          id => id !== moveItem.id
        )
      }
    }
    if (moveItemIsGroup) {
      group.bookmarkGroupIds = [
        moveItem.id,
        ...(group.bookmarkGroupIds || [])
      ]
    } else {
      group.bookmarkIds = [
        moveItem.id,
        ...(group.bookmarkIds || [])
      ]
    }
    props.onCancelMoveItem()
  }
  const modalProps = {
    open: openMoveModal,
    title: e('moveTo'),
    footer: null,
    onCancel: props.onCancelMoveItem
  }
  const treeProps = {
    treeData: data,
    onChange: setGroupId,
    placeholder: e('moveTo'),
    showSearch: true,
    value: groupId,
    popupMatchSelectWidth: false,
    treeDefaultExpandAll: true,
    className: 'width-100'
  }
  return (
    <Modal {...modalProps}>
      <div className='pd1'>
        <TreeSelect
          {...treeProps}
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
          onClick={props.onCancelMoveItem}
          className='mg1l'
        >
          {e('cancel')}
        </Button>
      </div>
    </Modal>
  )
}
