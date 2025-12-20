// render bookmark select, use antd tree
import { useState, useEffect } from 'react'
import {
  MergeOutlined,
  SearchOutlined
} from '@ant-design/icons'
import buildGroupData from '../bookmark-form/common/bookmark-group-tree-format'
import { Tree, Modal, Button, Input } from 'antd'
import { auto } from 'manate/react'
const e = window.translate

const rootId = '__root__'

// Helper function to filter tree data based on search text
function filterTreeData (data, searchText) {
  if (!searchText) {
    return data
  }
  const lowerSearch = searchText.toLowerCase()

  function filterNodes (nodes) {
    return nodes.reduce((acc, node) => {
      const titleText = typeof node.title === 'string'
        ? node.title
        : (node.title?.props?.children?.[1] || node.title?.props?.children || '')
      const titleStr = String(titleText).toLowerCase()
      const children = node.children ? filterNodes(node.children) : []

      if (titleStr.includes(lowerSearch) || children.length > 0) {
        acc.push({
          ...node,
          children: children.length > 0 ? children : node.children
        })
      }
      return acc
    }, [])
  }

  return filterNodes(data)
}

// Helper function to get all keys from tree data
function getAllKeys (data) {
  const keys = []
  function traverse (nodes) {
    for (const node of nodes) {
      keys.push(node.key)
      if (node.children) {
        traverse(node.children)
      }
    }
  }
  traverse(data)
  return keys
}

export default auto(function MoveItemModal (props) {
  const [groupId, setGroupId] = useState(undefined)
  const [searchText, setSearchText] = useState('')
  const {
    openMoveModal,
    moveItem,
    moveItemIsGroup,
    bookmarkGroups
  } = props.store

  function onCancelMoveItem () {
    window.store.storeAssign({
      openMoveModal: false,
      moveItem: null,
      moveItemIsGroup: false
    })
  }

  // Reset groupId and search when modal opens
  useEffect(() => {
    if (openMoveModal) {
      setGroupId(undefined)
      setSearchText('')
    }
  }, [openMoveModal])

  if (!openMoveModal) {
    return null
  }

  // Find current parent folder
  const currentParent = bookmarkGroups.find(bg => {
    if (moveItemIsGroup) {
      return (bg.bookmarkGroupIds || []).includes(moveItem.id)
    }
    return (bg.bookmarkIds || []).includes(moveItem.id)
  })
  const currentParentId = currentParent?.id

  // Build tree data with disabled folder for self and current parent
  const data = buildGroupData(bookmarkGroups, moveItemIsGroup ? moveItem.id : null, false, currentParentId)

  // if it is a group and can move to root, add root option
  if (moveItemIsGroup && currentParentId) {
    const title = <span><MergeOutlined /> {e('ROOT')}</span>
    data.unshift({
      title,
      value: rootId,
      key: rootId,
      disabled: false
    })
  }

  // Filter tree data based on search
  const filteredData = filterTreeData(data, searchText)
  const expandedKeys = getAllKeys(filteredData)

  function onTreeSelect (selectedKeys) {
    if (selectedKeys.length > 0) {
      // Find the node to check if it's disabled
      const findNode = (nodes, key) => {
        for (const node of nodes) {
          if (node.key === key) return node
          if (node.children) {
            const found = findNode(node.children, key)
            if (found) return found
          }
        }
        return null
      }
      const node = findNode(data, selectedKeys[0])
      if (node && !node.disabled) {
        setGroupId(selectedKeys[0])
      }
    }
  }

  function onSelect () {
    const {
      bookmarkGroups
    } = window.store

    const groupMap = new Map(bookmarkGroups.map(d => [d.id, d]))
    const group = groupMap.get(groupId)
    if (!group && groupId !== rootId) {
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
    if (groupId === rootId) {
      delete moveItem.level
      return onCancelMoveItem()
    }

    if (moveItemIsGroup) {
      moveItem.level = (group.level || 1) + 1
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
    onCancelMoveItem()
  }

  const footer = (
    <>
      <Button
        type='primary'
        onClick={onSelect}
        disabled={!groupId}
      >
        {e('ok')}
      </Button>
      <Button
        onClick={onCancelMoveItem}
        className='mg1l'
      >
        {e('cancel')}
      </Button>
    </>
  )

  const modalProps = {
    open: openMoveModal,
    title: e('moveTo'),
    footer,
    onCancel: onCancelMoveItem
  }

  const treeProps = {
    treeData: filteredData,
    onSelect: onTreeSelect,
    selectedKeys: groupId ? [groupId] : [],
    expandedKeys,
    autoExpandParent: true,
    className: 'width-100 move-item-tree'
  }

  return (
    <Modal {...modalProps}>
      <div className='pd1b'>
        <Input
          placeholder={e('search')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
        />
      </div>
      <div className='move-item-tree-wrap'>
        <Tree
          {...treeProps}
        />
      </div>
    </Modal>
  )
})
