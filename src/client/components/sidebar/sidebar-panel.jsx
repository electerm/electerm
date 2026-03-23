/**
 * bookmark select
 */

import { memo, useState } from 'react'
import BookmarkWrap from './bookmark'
import History from './history'
import { Tabs, Tooltip } from 'antd'
import MultiSelectModal from '../common/multi-select-modal'
import { Maximize2, Edit, PlusCircle, Shrink, Pin, Pointer } from 'lucide-react'

const e = window.translate

export default memo(function SidebarPanel (props) {
  const { sidebarPanelTab, pinned } = props
  const { store } = window
  const [openSelectModal, setOpenSelectModal] = useState(false)
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
        <Maximize2
          {...pop2}
        />
      </Tooltip>,
      <Tooltip title={e('collapseAll')} key='collapse'>
        <Shrink
          {...pop3}
        />
      </Tooltip>,
      <Tooltip title={e('open') + ' ' + e('bookmarks')} key='multi'>
        <Pointer
          {...prps}
          onClick={() => setOpenSelectModal(true)}
        />
      </Tooltip>
    ]
  }
  return (
    <div
      className='sidebar-panel bookmarks-panel animate-fast'
    >
      <div className='sidebar-pin-top'>
        <div className='pd1y pd2t pd2x sidebar-panel-control alignright'>
          <Tooltip title={e('newBookmark')}>
            <PlusCircle
              {...pop1}
            />
          </Tooltip>
          <Tooltip title={`${e('edit')} ${e('bookmarks')}`}>
            <Edit
              {...pop1}
            />
          </Tooltip>
          {
            renderExpandIcons()
          }
          <Tooltip title={e('pin')}>
            <Pin
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
      <MultiSelectModal
        open={openSelectModal}
        onClose={() => setOpenSelectModal(false)}
      />
    </div>
  )
})
