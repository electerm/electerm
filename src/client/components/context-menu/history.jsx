import { auto } from 'manate/react'
import { createTitleWithTag } from '../../common/create-title'

export default auto(function HistorySubMenu (props) {
  const { store } = props
  return (
    <div className='sub-context-menu'>
      {
        store.history.map(item => {
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
})
