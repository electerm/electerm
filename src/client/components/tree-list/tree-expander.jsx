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
    !group.bookmarkGroupIds &&
    !group.bookmarkGroupIds.length
  ) {
    return null
  }
  return props.expandedKeys.includes(group.id)
    ? (
      <CaretDownOutlined
        className='tree-expander pointer'
        onClick={onUnExpand}
      />
      )
    : (
      <CaretRightOutlined
        className='tree-expander pointer'
        onClick={onExpand}
      />
      )
}
