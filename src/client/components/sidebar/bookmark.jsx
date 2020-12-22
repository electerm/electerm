/**
 * history select
 */

import { Component } from '../common/react-subx'
import BookmarkSelect from './bookmark-select'
import _ from 'lodash'
import { ArrowsAltOutlined, EditOutlined, PlusCircleOutlined, ShrinkOutlined, PushpinOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')
const e = prefix('control')

export default class BookmarkPanel extends Component {
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
        className='sidebar-panel bookmarks-panel animate-fast'
        {..._.pick(props, ['onMouseEnter', 'onMouseLeave'])}
      >
        <div className='pd1y pd2t pd2x'>
          <div className='fix'>
            <div className='fleft'>{c('bookmarks')}</div>
            <div className='fright'>
              <Tooltip title={e('newSsh')}>
                <PlusCircleOutlined
                  {...prps}
                  onClick={store.onNewSsh} />
              </Tooltip>
              <Tooltip title={`${m('edit')} ${c('bookmarks')}`}>
                <EditOutlined
                  {...prps}
                  onClick={store.onNewSsh} />
              </Tooltip>
              <Tooltip title={c('expandAll')}>
                <ArrowsAltOutlined
                  {...prps}
                  onClick={store.expandBookmarks} />
              </Tooltip>
              <Tooltip title={c('collapseAll')}>
                <ShrinkOutlined
                  {...prps}
                  onClick={store.collapseBookmarks} />
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
          <BookmarkSelect store={store} />
        </div>
      </div>
    )
  }
}
