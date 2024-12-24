/**
 * history select
 */

import { auto } from 'manate/react'
import HistoryItem from './history-item'

export default auto(function HistoryPanel (props) {
  const { store } = window
  const {
    history
  } = store
  return (
    <div
      className='sidebar-panel-history'
    >
      <div className='pd2x'>
        {
          history.map((item, i) => {
            return (
              <HistoryItem
                key={item.id}
                index={i}
                item={item}
              />
            )
          })
        }
      </div>
    </div>
  )
})
