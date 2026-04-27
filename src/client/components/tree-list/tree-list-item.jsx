/**
 * tree list for bookmarks
 */

import { memo, useState } from 'react'

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
import createName, { createTitleTag } from '../../common/create-title'
import classnames from 'classnames'
import {
  defaultBookmarkGroupId
} from '../../common/constants'
import highlight from '../common/highlight'
import uid from '../../common/uid'

const e = window.translate

function getItemLabel (item, isGroup) {
  return isGroup
    ? item?.title || ''
    : createName(item)
}

function areEqual (prevProps, nextProps) {
  const prevSelected = prevProps.selectedItemId === prevProps.item.id
  const nextSelected = nextProps.selectedItemId === nextProps.item.id

  return prevProps.isGroup === nextProps.isGroup &&
    prevProps.parentId === nextProps.parentId &&
    prevProps.staticList === nextProps.staticList &&
    prevProps.keyword === nextProps.keyword &&
    prevSelected === nextSelected &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.level === nextProps.item.level &&
    prevProps.item.color === nextProps.item.color &&
    prevProps.item.description === nextProps.item.description &&
    getItemLabel(prevProps.item, prevProps.isGroup) === getItemLabel(nextProps.item, nextProps.isGroup)
}

function TreeListItem (props) {
  const [hovered, setHovered] = useState(false)

  const handleDel = (e) => {
    props.del(props.item, e)
  }

  const renderDelBtn = (item) => {
    if (props.item.id === defaultBookmarkGroupId || props.staticList) {
      return null
    }
    return (
      <Popconfirm
        title={e('del') + '?'}
        onConfirm={handleDel}
        okText={e('del')}
        cancelText={e('cancel')}
        placement='top'
      >
        <CloseOutlined title={e('del')} className='pointer tree-control-btn' />
      </Popconfirm>
    )
  }

  const renderOperationBtn = (item, isGroup) => {
    if (props.staticList || props.item.id === defaultBookmarkGroupId) {
      return null
    }
    return (
      <RightSquareOutlined
        className='pointer tree-control-btn'
        onClick={openMoveModal}
      />
    )
  }

  const handleOpenAll = () => {
    props.openAll(props.item)
  }

  const openMoveModal = (e) => {
    props.openMoveModal(e, props.item, props.isGroup)
  }

  const handleEditItem = (e) => {
    props.editItem(e, props.item, props.isGroup)
  }

  const handleAddSubCat = (e) => {
    props.addSubCat(e, props.item)
  }

  const renderAddNewSubGroupBtn = () => {
    if (props.staticList) {
      return null
    }
    return (
      <FolderAddOutlined
        key='new-tree'
        title={`${e('new')} ${e('bookmarkCategory')}`}
        onClick={handleAddSubCat}
        className='pointer tree-control-btn'
      />
    )
  }

  const renderEditBtn = () => {
    const {
      isGroup, staticList
    } = props
    if (
      (staticList && isGroup) ||
      (!staticList && !isGroup)
    ) {
      return null
    }
    return (
      <EditOutlined
        title={e('edit')}
        key='edit-tree'
        onClick={handleEditItem}
        className='pointer edit-icon tree-control-btn'
      />
    )
  }

  const onSelect = (e) => {
    props.onSelect(e)
  }

  const renderOpenAll = () => {
    const {
      staticList,
      isGroup
    } = props
    if (
      (staticList && !isGroup) ||
      !staticList
    ) {
      return null
    }
    return (
      <Tooltip title={e('openAll')}>
        <FolderOpenOutlined
          key='open-all-tree'
          onClick={handleOpenAll}
          className='pointer open-all-icon tree-control-btn'
        />
      </Tooltip>
    )
  }

  const handleDuplicateItem = (e) => {
    props.duplicateItem(e, props.item)
  }

  const renderDuplicateBtn = () => {
    const {
      item,
      staticList
    } = props
    if (!item.id || staticList) {
      return null
    }
    return (
      <CopyOutlined
        title={e('duplicate')}
        className='pointer tree-control-btn'
        onClick={handleDuplicateItem}
      />
    )
  }

  const renderGroupBtns = () => {
    return [
      renderAddNewSubGroupBtn(),
      renderOpenAll()
    ]
  }

  const onDragOver = e => {
    props.onDragOver(e)
  }

  const onDragStart = e => {
    props.onDragStart(e)
  }

  const onDragEnter = e => {
    props.onDragEnter(e)
  }

  const onDragLeave = e => {
    props.onDragLeave(e)
  }

  const onDrop = e => {
    props.onDrop(e)
  }

  const {
    item,
    isGroup,
    selectedItemId
  } = props
  const cls = classnames(
    {
      selected: selectedItemId === item.id
    },
    'tree-item',
    {
      'is-category': isGroup,
      level2: item.level === 2
    }
  )
  const tag = isGroup ? '' : createTitleTag(item)
  const colorTag = isGroup && item.color
    ? (
      <span
        className='category-color-tag'
        style={{
          backgroundColor: item.color
        }}
      />
      )
    : null
  const title = isGroup
    ? item.title
    : createName(item)
  const titleAll = title + (item.description ? ' - ' + item.description : '')
  const titleHighlight = isGroup
    ? item.title || 'no title'
    : highlight(
      title,
      props.keyword
    )
  const propsAll = {
    className: cls,
    title: titleAll,
    draggable: true,
    'data-item-id': item.id,
    'data-parent-id': props.parentId,
    'data-is-group': isGroup ? 'true' : 'false',
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onDragOver,
    onDragStart,
    onDragEnter,
    onDragLeave,
    onDrop
  }
  const titleProps = {
    className: 'tree-item-title elli',
    onClick: onSelect,
    'data-item-id': item.id,
    'data-is-group': isGroup ? 'true' : 'false',
    'data-parent-id': props.parentId
  }
  const key = item.id || uid()
  return (
    <div
      {...propsAll}
      key={key}
    >
      <div
        {...titleProps}
      >
        {colorTag}{tag}{titleHighlight}
      </div>
      {
        hovered && isGroup
          ? renderGroupBtns()
          : null
      }
      {
        hovered && !isGroup
          ? renderDuplicateBtn()
          : null
      }
      {hovered ? renderOperationBtn() : null}
      {hovered ? renderDelBtn() : null}
      {hovered ? renderEditBtn() : null}
    </div>
  )
}

export default memo(TreeListItem, areEqual)
