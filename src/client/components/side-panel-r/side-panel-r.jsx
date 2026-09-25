import React, { memo, useRef, useEffect } from 'react'
import DragHandle from '../common/drag-handle'
import './right-side-panel.styl'
import {
  CloseCircleOutlined,
  PushpinOutlined,
  BarChartOutlined,
  HistoryOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import {
  Typography,
  Flex,
  Tag
} from 'antd'

export default memo(function RightSidePanel (
  {
    rightPanelVisible,
    rightPanelPinned,
    rightPanelWidth,
    children,
    title,
    rightPanelTab,
    isMobile
  }
) {
  const panelRef = useRef(null)

  // Esc closes the panel, but never at the terminal's expense: xterm forwards
  // Esc to the remote shell, so stealing it there would break vim, less, etc.
  // The guard checks the event target rather than focus state, because the
  // keydown bubbles up from xterm's textarea inside .term-wrap — the same
  // selector shortcut-bar-entry.jsx uses to detect terminal focus. A modal owns
  // Esc while one is open. This hook has to stay above the early return below
  // so the hook order never changes.
  useEffect(() => {
    if (!rightPanelVisible) {
      return
    }
    function onKeyDown (event) {
      if (event.key !== 'Escape' || window.store.showModal) {
        return
      }
      const { target } = event
      if (target && typeof target.closest === 'function' && target.closest('.term-wrap')) {
        return
      }
      window.store.rightPanelVisible = false
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [rightPanelVisible])

  if (!rightPanelVisible) {
    return null
  }
  // Mobile has no pin control (it is not rendered below), so a pin persisted
  // from a desktop session must not turn the panel into a dock here — that
  // would make it full height over the footer for no reachable reason.
  const pinned = rightPanelPinned && !isMobile
  // one glyph per tab, so the panel says what it is showing; the info tab is
  // the fallback, since a stale or unknown tab falls back to it everywhere else
  const tagMap = {
    ai: <Tag className='mg1r'>AI</Tag>,
    cmdHistory: <HistoryOutlined className='mg1r' />,
    quickCommands: <ThunderboltOutlined className='mg1r' />
  }
  const tag = tagMap[rightPanelTab] || <BarChartOutlined className='mg1r' />

  function onDragEnd (nw) {
    window.store.setRightSidePanelWidth(nw)
  }

  function onDragMove (nw) {
    if (panelRef.current) {
      panelRef.current.style.width = nw + 'px'
    }
  }

  function onClose () {
    window.store.rightPanelVisible = false
  }

  function togglePin () {
    window.store.setRightPanelPinned(!window.store.rightPanelPinned)
  }

  const panelProps = {
    className: 'right-side-panel animate-fast' + (pinned ? ' right-side-panel-pinned' : ''),
    ref: panelRef,
    style: {
      width: `${rightPanelWidth}px`
    }
  }

  const pinProps = {
    className: 'right-side-panel-pin right-side-panel-controls' + (pinned ? ' pinned' : ''),
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
      {/* Mobile panels are full-screen drawers (see store.rightPanelWidth):
          their width is the viewport and is not adjustable, so the resize
          handle is not rendered — it would otherwise sit on the screen's left
          edge and drag a size the panel never uses. */}
      {!isMobile && <DragHandle {...dragProps} />}
      <Flex
        className='right-panel-title pd2'
        justify='space-between'
        align='center'
      >
        <Typography.Text level={4} ellipsis style={{ margin: 0, flex: 1 }}>
          {tag} {title}
        </Typography.Text>
        <Flex>
          {!isMobile && (
            <PushpinOutlined
              {...pinProps}
            />
          )}
          <CloseCircleOutlined
            className='right-side-panel-close right-side-panel-controls mg1l'
            onClick={onClose}
          />
        </Flex>
      </Flex>
      <div className='right-side-panel-content'>
        {children}
      </div>
    </div>
  )
})
