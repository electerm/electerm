/**
 * tree list for bookmarks
 */

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
import './tree-list.styl'

const e = window.translate

export default function TreeListItem (props) {
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
    'tree-item elli',
    {
      'is-category': isGroup,
      level2: item.level === 2
    }
  )
  const tag = isGroup ? '' : createTitleTag(item)
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
    onDragOver,
    onDragStart,
    onDragLeave,
    onDrop
  }
  const titleProps = {
    className: 'tree-item-title elli',
    onClick: onSelect,
    'data-item-id': item.id,
    'data-is-group': isGroup ? 'true' : 'false',
    'data-parent-id': props.parentId,
    style: props.staticList
      ? { maxWidth: (props.leftSidebarWidth - 110) + 'px' }
      : undefined
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
        {tag}{titleHighlight}
      </div>
      {
        isGroup
          ? renderGroupBtns()
          : null
      }
      {
        !isGroup
          ? renderDuplicateBtn()
          : null
      }
      {renderOperationBtn()}
      {renderDelBtn()}
      {renderEditBtn()}
    </div>
  )
}
