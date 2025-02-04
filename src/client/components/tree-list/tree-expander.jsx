import {
  CaretDownOutlined,
  CaretRightOutlined
} from '@ant-design/icons'

export default function TreeExpander (props) {
  function onExpand () {
    props.onExpand(group)
  }
  function onUnExpand () {
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
