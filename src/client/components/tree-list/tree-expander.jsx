import { ChevronDown, ChevronRight } from 'lucide-react'

export default function TreeExpander (props) {
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
    ? ChevronDown
    : ChevronRight
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
