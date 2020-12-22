/**
 * history select
 */

import { Component } from '../common/react-subx'
import ItemList from '../setting-panel/list'
import _ from 'lodash'
import { EditOutlined, PushpinOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')

export default class HistoryPanel extends Component {
  render () {
    const { props } = this
    const { store } = props
    const prps = {
      className: 'font16 mg1x mg2l pointer iblock control-icon'
    }
    const prps1 = {
      className: prps.className + (store.pinned ? ' pinned' : '')
    }
    return (
      <div
        className='sidebar-panel history-panel animate-fast'
        {..._.pick(props, ['onMouseEnter', 'onMouseLeave'])}
      >
        <div className='pd1y pd2t pd2x'>
          <div className='fix'>
            <div className='fleft'>{c('history')}</div>
            <div className='fleft'>
              <Tooltip title={`${m('edit')} ${c('history')}`}>
                <EditOutlined
                  className='font16 mg1x mg2l pointer iblock control-icon icon-do-edit'
                  onClick={store.onEditHistory} />
              </Tooltip>
              <Tooltip title={c('pin')}>
                <PushpinOutlined
                  {...prps1}
                  onClick={store.pin} />
              </Tooltip>
            </div>
          </div>
        </div>
        <div className='pd2x'>
          <ItemList
            type='history'
            list={store.history || []}
            onClickItem={item => store.onSelectHistory(item.id)}
            activeItemId={store.activeItemId}
          />
        </div>
      </div>
    )
  }
}
