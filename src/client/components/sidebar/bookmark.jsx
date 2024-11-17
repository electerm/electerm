/**
 * history select
 */

import { memo } from 'react'
import BookmarkSelect from './bookmark-select'
import { pick } from 'lodash-es'
import { ArrowsAltOutlined, EditOutlined, PlusCircleOutlined, ShrinkOutlined, PushpinOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

const e = window.translate

export default memo(function BookmarkPanel (props) {
  const { pinned } = props
  const prps = {
    className: 'font16 mg1x mg2l pointer iblock control-icon'
  }
  const prps1 = {
    className: prps.className + (pinned ? ' pinned' : '')
  }
  const { store } = window
  const pop1 = {
    ...prps,
    onClick: store.onNewSsh
  }
  const pop2 = {
    ...prps,
    onClick: store.expandBookmarks
  }
  const pop3 = {
    ...prps,
    onClick: store.collapseBookmarks
  }
  return (
    <div
      className='sidebar-panel bookmarks-panel animate-fast'
      {...pick(props, ['onMouseEnter', 'onMouseLeave'])}
    >
      <div className='pd1y pd2t pd2x'>
        <div className='fix'>
          <div className='fleft'>{e('bookmarks')}</div>
          <div className='fright'>
            <Tooltip title={e('newBookmark')}>
              <PlusCircleOutlined
                {...pop1}
              />
            </Tooltip>
            <Tooltip title={`${e('edit')} ${e('bookmarks')}`}>
              <EditOutlined
                {...pop1}
              />
            </Tooltip>
            <Tooltip title={e('expandAll')}>
              <ArrowsAltOutlined
                {...pop2}
              />
            </Tooltip>
            <Tooltip title={e('collapseAll')}>
              <ShrinkOutlined
                {...pop3}
              />
            </Tooltip>
            <Tooltip title={e('pin')}>
              <PushpinOutlined
                {...prps1}
                onClick={store.handlePin}
              />
            </Tooltip>
          </div>
        </div>
      </div>
      <div className='pd2l sidebar-inner'>
        <BookmarkSelect store={store} from='sidebar' />
      </div>
    </div>
  )
})
