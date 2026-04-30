/**
 * tree list for bookmarks
 */

import { memo } from 'react'
import createName, { createTitleTag } from '../../common/create-title'
import classnames from 'classnames'
import highlight from '../common/highlight'
import uid from '../../common/uid'

function getItemLabel (item, isGroup) {
  return isGroup
    ? item?.title || ''
    : createName(item)
}

function areEqual (prevProps, nextProps) {
  const prevSelected = prevProps.selectedItemId === prevProps.item.id
  const nextSelected = nextProps.selectedItemId === nextProps.item.id
  const prevSearchSelected = Boolean(prevProps.searchSelected)
  const nextSearchSelected = Boolean(nextProps.searchSelected)

  return prevProps.isGroup === nextProps.isGroup &&
    prevProps.parentId === nextProps.parentId &&
    prevProps.staticList === nextProps.staticList &&
    prevProps.keyword === nextProps.keyword &&
    prevSelected === nextSelected &&
    prevSearchSelected === nextSearchSelected &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.level === nextProps.item.level &&
    prevProps.item.color === nextProps.item.color &&
    prevProps.item.description === nextProps.item.description &&
    getItemLabel(prevProps.item, prevProps.isGroup) === getItemLabel(nextProps.item, nextProps.isGroup)
}

function TreeListItem (props) {
  const onSelect = (e) => {
    props.onSelect(e)
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
      selected: selectedItemId === item.id,
      'search-selected': props.searchSelected
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
    </div>
  )
}

export default memo(TreeListItem, areEqual)
