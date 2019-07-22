/**
 * history select
 */

import { memo } from 'react'
import BookmarkSelect from './bookmark-select'
import _ from 'lodash'
import {
  Icon,
  Tooltip
} from 'antd'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')
const e = prefix('control')

export default memo((props) => {
  const { store } = props
  return (
    <div
      className='sidebar-panel bookmarks-panel animate-fast'
      {..._.pick(props, ['onMouseEnter', 'onMouseLeave'])}
    >
      <div className='pd1y pd2t pd2x'>
        <div className='fix'>
          <div className='fleft'>{c('bookmarks')}</div>
          <div className='fright'>
            <Tooltip title={e('newSsh')}>
              <Icon
                type='plus-circle'
                className='font16 mg1x mg2l pointer iblock control-icon icon-do-edit'
                onClick={store.onNewSsh}
              />
            </Tooltip>
            <Tooltip title={`${m('edit')} ${c('bookmarks')}`}>
              <Icon
                type='edit'
                className='font16 mg1x mg2l pointer iblock control-icon icon-do-edit'
                onClick={store.onNewSsh}
              />
            </Tooltip>
          </div>
        </div>
      </div>
      <div className='pd2x'>
        <BookmarkSelect store={store} />
      </div>
    </div>
  )
})
