/**
 * bookmark/history item list
 */

import {memo} from 'react'
import createName from '../../common/create-title'

export default memo((props) => {
  let {list, cls = 'bookmark', onClick} = props
  return (
    <div className={`item-list ${cls}`}>
      {
        list.map(item => {
          return (
            <div className="item-slot" onClick={() => onClick(item)}>
              {createName(item)}
            </div>
          )
        })
      }
    </div>
  )
})
