/**
 * Add button menu component
 */

import React, { useCallback, useState } from 'react'
import { Tabs } from 'antd'
import {
  CodeFilled,
  RightSquareFilled,
  RobotOutlined
} from '@ant-design/icons'
import BookmarksList from '../sidebar/bookmark-select'
import History from '../sidebar/history'
import DragHandle from '../common/drag-handle'
import QuickConnect from './quick-connect'

const e = window.translate

export default function AddBtnMenu ({
  menuRef,
  menuPosition,
  menuTop,
  menuLeft,
  onMenuScroll,
  onTabAdd,
  batch,
  addPanelWidth,
  setAddPanelWidth
}) {
  const { onNewSsh, onNewSshAI } = window.store
  const [activeTab, setActiveTab] = useState('bookmarks')
  const cls = 'pd2x pd1y context-item pointer'
  const addTabBtn = window.store.hasNodePty
    ? (
      <div
        className={cls}
        onClick={onTabAdd}
      >
        <RightSquareFilled /> {e('newTab')}
      </div>
      )
    : null

  const onDragEnd = useCallback((nw) => {
    if (setAddPanelWidth) {
      setAddPanelWidth(nw)
    }
  }, [setAddPanelWidth])

  const onDragMove = useCallback((nw) => {
    if (menuRef.current) {
      menuRef.current.style.width = nw + 'px'
    }
  }, [menuRef])

  const dragProps = {
    min: 300,
    max: 600,
    width: addPanelWidth || 300,
    onDragEnd,
    onDragMove,
    left: menuPosition === 'right'
  }

  const tabItems = [
    {
      key: 'bookmarks',
      label: e('bookmarks')
    },
    {
      key: 'history',
      label: e('history')
    }
  ]

  let listContent
  if (activeTab === 'bookmarks') {
    listContent = <BookmarksList store={window.store} />
  } else {
    listContent = <History store={window.store} />
  }

  return (
    <div
      ref={menuRef}
      className={`add-menu-wrap add-menu-${menuPosition}`}
      style={{
        maxHeight: window.innerHeight - menuTop - 50,
        top: menuTop,
        left: menuLeft,
        width: addPanelWidth ? addPanelWidth + 'px' : undefined
      }}
      onScroll={onMenuScroll}
    >
      <DragHandle
        {...dragProps}
      />
      <div className='add-menu-header'>
        <div
          className={cls}
          onClick={onNewSsh}
        >
          <CodeFilled /> {e('newBookmark')}
        </div>
        {addTabBtn}
        <div
          className={cls}
          onClick={onNewSshAI}
        >
          <RobotOutlined /> {e('createBookmarkByAI')}
        </div>
        <QuickConnect batch={batch} inputOnly />
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </div>
      <div className='add-menu-list'>
        {listContent}
      </div>
    </div>
  )
}
