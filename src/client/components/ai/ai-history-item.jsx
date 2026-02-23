import { Tag, Tooltip } from 'antd'

export default function AiHistoryItem (props) {
  const {
    item,
    onSelect,
    onDelete,
    renderItem
  } = props

  // If a custom render function is provided, use it to get the display string and title
  // otherwise assume it's a string
  let displayItem = ''
  let fullItem = ''

  if (renderItem) {
    const renderedInfo = renderItem(item)
    displayItem = renderedInfo.label
    fullItem = renderedInfo.title || renderedInfo.label
  } else {
    fullItem = item
    displayItem = item.length > 50 ? `${item.slice(0, 50)}...` : item
  }

  const isLong = fullItem.length > 50
  const tagElem = (
    <Tag
      closable
      onClose={(event) => onDelete(item, event)}
      onClick={() => onSelect(item)}
      className='pointer'
    >
      {displayItem}
    </Tag>
  )

  return isLong
    ? (
      <Tooltip title={fullItem}>
        {tagElem}
      </Tooltip>
      )
    : (
        tagElem
      )
}
