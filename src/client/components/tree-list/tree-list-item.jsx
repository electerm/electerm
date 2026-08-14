/**
 * tree list for bookmarks
 */

import { memo } from 'react'
import { createTitleTag } from '../../common/create-title'
import { terminalLocalType } from '../../common/constants'
import classnames from 'classnames'
import highlight from '../common/highlight'
import uid from '../../common/uid'

const e = window.translate

function buildSubtitle (item) {
  if (item.host) {
    return item.port ? `${item.host}:${item.port}` : item.host
  }
  if (item.path) {
    return item.path
  }
  if (item.url) {
    return item.url
  }
  return ''
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
    prevProps.itemLevel === nextProps.itemLevel &&
    prevProps.itemColor === nextProps.itemColor &&
    prevProps.itemDescription === nextProps.itemDescription &&
    prevProps.itemLabel === nextProps.itemLabel
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
    : props.itemLabel
  const titleAll = title + (item.description ? ' - ' + item.description : '')
  const subtitleRaw = isGroup ? '' : buildSubtitle(item)
  const primaryText = isGroup
    ? (item.title || 'no title')
    : (item.title || subtitleRaw || e(terminalLocalType))
  const showSubtitle = !isGroup && subtitleRaw && item.title
  const titleHighlight = highlight(primaryText, props.keyword)
  const subtitleHighlight = showSubtitle
    ? highlight(subtitleRaw, props.keyword)
    : null
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
    className: classnames('tree-item-title', 'elli', { 'has-subtitle': showSubtitle }),
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
        {colorTag}{tag}
        <span className='tree-item-text'>
          <span className='tree-item-title-main elli'>{titleHighlight}</span>
          {
            showSubtitle
              ? <span className='tree-item-subtitle elli'>{subtitleHighlight}</span>
              : null
          }
        </span>
        {
          isGroup && item.bookmarkIds
            ? <span className='tree-item-count'>{item.bookmarkIds.length}</span>
            : null
        }
      </div>
    </div>
  )
}

export default memo(TreeListItem, areEqual)
