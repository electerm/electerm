/**
 * history select
 */

import { Component } from '../common/react-subx'
import ItemList from '../setting-panel/list'
import { pick } from 'lodash-es'
import { EditOutlined, PushpinOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')

export default class HistoryPanel extends Component {
  render () {
    const { props } = this
    const { store } = props
    const {
      openedSideBar
    } = store
    if (openedSideBar !== 'history') {
      return null
    }
    const prps = {
      className: 'font16 mg1x mg2l pointer iblock control-icon'
    }
    const prps1 = {
      className: prps.className + (store.pinned ? ' pinned' : '')
    }
    return (
      <div
        className='sidebar-panel history-panel animate-fast'
        {...pick(props, ['onMouseEnter', 'onMouseLeave'])}
      >
        <div className='pd1y pd2t pd2x'>
          <div className='fix'>
            <div className='fleft'>{c('history')}</div>
            <div className='fleft'>
              <Tooltip title={`${m('edit')} ${c('history')}`}>
                <EditOutlined
                  className='font16 mg1x mg2l pointer iblock control-icon icon-do-edit'
                  onClick={store.handleEditHistory}
                />
              </Tooltip>
              <Tooltip title={c('pin')}>
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
            list={store.history || []}
            onClickItem={item => store.onSelectHistory(item.id)}
            activeItemId={store.activeItemId}
          />
        </div>
      </div>
    )
  }
}
