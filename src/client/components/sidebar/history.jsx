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
  const arr = props.sort
    ? [...history].sort((a, b) => { return b.count - a.count })
    : history
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
