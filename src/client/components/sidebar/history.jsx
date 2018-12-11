/**
 * history select
 */

import {memo} from 'react'
import ItemList from '../setting-panel/list'
import _ from 'lodash'
import {
  Icon,
  Tooltip
} from 'antd'

const {prefix} = window
const c = prefix('common')
const m = prefix('menu')

export default memo((props) => {
  return (
    <div
      className="sidebar-panel history-panel animate-fast"
      {..._.pick(props, ['onMouseEnter', 'onMouseLeave'])}
    >
      <div className="pd1y pd2t pd2x">
        <div className="fix">
          <div className="fleft">{c('history')}</div>
          <div className="fleft">
            <Tooltip title={`${m('edit')} ${c('history')}`}>
              <Icon
                type="edit"
                className="font16 mg1x mg2l pointer iblock control-icon icon-do-edit"
                onClick={props.onEditHistory}
              />
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="pd2x">
        <ItemList
          {...props}
          type="history"
          list={props.history || []}
          onClickItem={item => props.onSelectHistory(item.id)}
          activeItemId={props.activeItemId}
        />
      </div>
    </div>
  )
})
