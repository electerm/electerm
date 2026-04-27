import { memo } from 'react'

import {
  CaretDownOutlined,
  CaretRightOutlined
} from '@ant-design/icons'

function hasChildren (group) {
  return Boolean(
    group?.bookmarkIds?.length ||
    group?.bookmarkGroupIds?.length
  )
}

function isOpen (props) {
  return Boolean(props.keyword) || props.expandedKeys.includes(props.group.id)
}

function areEqual (prevProps, nextProps) {
  return prevProps.group?.id === nextProps.group?.id &&
    hasChildren(prevProps.group) === hasChildren(nextProps.group) &&
    Boolean(prevProps.keyword) === Boolean(nextProps.keyword) &&
    isOpen(prevProps) === isOpen(nextProps)
}

function TreeExpander (props) {
  function onExpand (e) {
    e.stopPropagation()
    props.onExpand(group)
  }
  function onUnExpand (e) {
    e.stopPropagation()
    props.onUnExpand(group)
  }
  const { group } = props
  if (
    !group?.bookmarkIds?.length &&
    !group?.bookmarkGroupIds?.length
  ) {
    return null
  }
  const shouldOpen = props.keyword || props.expandedKeys.includes(group.id)
  const Icon = shouldOpen
    ? CaretDownOutlined
    : CaretRightOutlined
  const func = shouldOpen
    ? onUnExpand
    : onExpand
  return (
    <div
      className='tree-expander pointer'
      onClick={func}
    >
      <Icon />
    </div>
  )
}

export default memo(TreeExpander, areEqual)
