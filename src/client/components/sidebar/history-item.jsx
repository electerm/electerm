import createTitle, { createTitleWithTag } from '../../common/create-title'

export default function HistoryItem (props) {
  const { store } = window
  const {
    item
  } = props
  function handleClick () {
    store.onSelectHistory(item.tab)
  }
  const title = createTitleWithTag(item.tab)
  const tt = createTitle(item.tab)
  return (
    <div
      className='item-list-unit'
      title={tt}
      onClick={handleClick}
    >
      <div className='elli pd1y pd2x'>
        {title}
      </div>
    </div>
  )
}
