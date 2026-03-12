/**
 * history select
 */

import { auto } from 'manate/react'
import HistoryItem from './history-item'

export default auto(function HistoryPanel (props) {
  const { store } = window
  if (store.config.disableConnectionHistory) {
    return null
  }
  const {
    history
  } = store
  const arr = [...history].sort((a, b) => { return b.count - a.count })
  return (
    <div
      className='sidebar-panel-history'
    >
      <div className='pd2x'>
        {
          arr.map((item, i) => {
            return (
              <HistoryItem
                key={item.id}
                item={item}
              />
            )
          })
        }
      </div>
    </div>
  )
})
