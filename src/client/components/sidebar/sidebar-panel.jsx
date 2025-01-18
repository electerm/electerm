/**
 * bookmark select
 */

import { memo } from 'react'
import BookmarkWrap from './bookmark'
import History from './history'
import { pick } from 'lodash-es'
import { Tabs, Tooltip } from 'antd'
import { ArrowsAltOutlined, EditOutlined, PlusCircleOutlined, ShrinkOutlined, PushpinOutlined } from '@ant-design/icons'

const e = window.translate

export default memo(function SidebarPanel (props) {
  const { sidebarPanelTab, pinned } = props
  const { store } = window
  const prps = {
    className: 'font16 mg1x mg2l pointer iblock control-icon'
  }
  const prps1 = {
    className: prps.className + (pinned ? ' pinned' : '')
  }
  const tabsProps = {
    activeKey: sidebarPanelTab,
    onChange: store.handleSidebarPanelTab,
    items: [
      {
        key: 'bookmarks',
        label: e('bookmarks'),
        children: null
      },
      {
        key: 'history',
        label: e('history'),
        children: null
      }
    ]
  }
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

  function renderExpandIcons () {
    if (sidebarPanelTab !== 'bookmarks') {
      return null
    }
    return [
      <Tooltip title={e('expandAll')} key='expand'>
        <ArrowsAltOutlined
          {...pop2}
        />
      </Tooltip>,
      <Tooltip title={e('collapseAll')} key='collapse'>
        <ShrinkOutlined
          {...pop3}
        />
      </Tooltip>
    ]
  }
  return (
    <div
      className='sidebar-panel bookmarks-panel animate-fast'
      {...pick(props, ['onMouseEnter', 'onMouseLeave'])}
    >
      <div className='sidebar-pin-top'>
        <div className='pd1y pd2t pd2x sidebar-panel-control alignright'>
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
          {
            renderExpandIcons()
          }
          <Tooltip title={e('pin')}>
            <PushpinOutlined
              {...prps1}
              onClick={store.handlePin}
            />
          </Tooltip>
        </div>
        <div className='pd1y pd2x'>
          <Tabs {...tabsProps} />
        </div>
      </div>
      {
        sidebarPanelTab === 'bookmarks'
          ? <BookmarkWrap {...props} />
          : <History store={store} />
      }
    </div>
  )
})
