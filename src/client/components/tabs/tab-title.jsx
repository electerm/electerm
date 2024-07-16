import createName from '../../common/create-title'

export default function tabTitle (props) {
  const { tab } = props
  const title = createName(tab)
  const { tabCount, color } = props.tab
  const styleTag = color
    ? { color }
    : {}
  return (
    <span className='tab-title'>
      <span style={styleTag}>●</span> {tabCount}. {title}
    </span>
  )
}
