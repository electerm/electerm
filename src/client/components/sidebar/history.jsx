/**
 * history select
 */

import { memo } from 'react'
import ItemList from '../setting-panel/list'
import { pick } from 'lodash-es'
import { EditOutlined, PushpinOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

const e = window.translate

export default memo(function HistoryPanel (props) {
  const { store } = window
  const {
    openedSideBar,
    pinned,
    history,
    activeItemId
  } = props
  if (openedSideBar !== 'history') {
    return null
  }
  const prps = {
    className: 'font16 mg1x mg2l pointer iblock control-icon'
  }
  const prps1 = {
    className: prps.className + (pinned ? ' pinned' : '')
  }
  function handleClickItem (item) {
    store.onSelectHistory(item.id)
  }
  return (
    <div
      className='sidebar-panel history-panel animate-fast'
      {...pick(props, ['onMouseEnter', 'onMouseLeave'])}
    >
      <div className='pd1y pd2t pd2x'>
        <div className='fix'>
          <div className='fleft'>{e('history')}</div>
          <div className='fleft'>
            <Tooltip title={`${e('edit')} ${e('history')}`}>
              <EditOutlined
                className='font16 mg1x mg2l pointer iblock control-icon icon-do-edit'
                onClick={store.handleEditHistory}
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
      <div className='pd2x'>
        <ItemList
          type='history'
          list={history || []}
          onClickItem={handleClickItem}
          activeItemId={activeItemId}
        />
      </div>
    </div>
  )
})
