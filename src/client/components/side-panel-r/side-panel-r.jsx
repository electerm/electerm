import React, { useRef, memo } from 'react'
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

  const dragStart = useRef(false)
  const clientX = useRef(0)

  function handleMousedown (e) {
    dragStart.current = true
    clientX.current = e.clientX
    document.body.addEventListener('mouseup', handleMouseup)
    document.body.addEventListener('mousemove', handleMousemove)
  }

  function handleMouseup (e) {
    dragStart.current = false
    const {
      clientX: cx
    } = e
    let nw = clientX.current - cx + rightPanelWidth
    if (nw < 400) {
      nw = 400
    } else if (nw > 1000) {
      nw = 1000
    }
    window.store.setRightSidePanelWidth(nw)
    document.body.removeEventListener('mouseup', handleMouseup)
    document.body.removeEventListener('mousemove', handleMousemove)
  }

  function handleMousemove (e) {
    const {
      clientX: cx
    } = e
    const el = document.getElementById('right-side-panel')
    let nw = clientX.current - cx + rightPanelWidth
    if (nw < 400) {
      nw = 400
    } else if (nw > 1000) {
      nw = 1000
    }
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

  return (
    <div
      {...panelProps}
    >
      <div
        className='drag-handle'
        onMouseDown={handleMousedown}
        draggable={false}
      />
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
