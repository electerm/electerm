import { createTitleWithTag } from '../../common/create-title'

export default function HistorySubMenu (props) {
  const { store } = window
  return (
    <div className='sub-context-menu'>
      {
        props.history.map(item => {
          const title = createTitleWithTag(item)
          return (
            <div
              className='sub-context-menu-item'
              title={title}
              key={item.id}
              onClick={() => store.onSelectHistory(item.id)}
            >
              {title}
            </div>
          )
        })
      }
    </div>
  )
}
