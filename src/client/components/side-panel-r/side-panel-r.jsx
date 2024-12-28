import React, { memo } from 'react'
import DragHandle from '../common/drag-handle'
import './right-side-panel.styl'
import {
  CloseCircleOutlined,
  PushpinOutlined
} from '@ant-design/icons'

export default memo(function RightSidePanel (
  {
    rightPanelVisible,
    rightPanelPinned,
    rightPanelWidth,
    children
  }
) {
  if (!rightPanelVisible) {
    return null
  }

  function onDragEnd (nw) {
    window.store.setRightSidePanelWidth(nw)
  }

  function onDragMove (nw) {
    const el = document.getElementById('right-side-panel')
    el.style.width = nw + 'px'
  }

  function onClose () {
    window.store.rightPanelVisible = false
  }

  function togglePin () {
    window.store.rightPanelPinned = !window.store.rightPanelPinned
  }

  const panelProps = {
    className: 'right-side-panel animate-fast',
    id: 'right-side-panel',
    style: {
      width: `${rightPanelWidth}px`
    }
  }

  const pinProps = {
    className: 'right-side-panel-pin right-side-panel-controls' + (rightPanelPinned ? ' pinned' : ''),
    onClick: togglePin
  }
  const dragProps = {
    min: 400,
    max: 1000,
    width: rightPanelWidth,
    onDragEnd,
    onDragMove,
    left: false
  }
  return (
    <div
      {...panelProps}
    >
      <DragHandle {...dragProps} />
      <CloseCircleOutlined
        className='right-side-panel-close right-side-panel-controls'
        onClick={onClose}
      />
      <PushpinOutlined
        {...pinProps}
      />
      <div className='right-side-panel-content'>
        {children}
      </div>
    </div>
  )
})
