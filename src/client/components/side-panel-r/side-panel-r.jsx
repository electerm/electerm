import React, { memo, useRef } from 'react'
import DragHandle from '../common/drag-handle'
import './right-side-panel.styl'
import {
  CloseCircleOutlined,
  PushpinOutlined,
  InfoCircleOutlined
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
    rightPanelTab
  }
) {
  const panelRef = useRef(null)

  if (!rightPanelVisible) {
    return null
  }
  const tag = rightPanelTab === 'ai'
    ? <Tag className='mg1r'>AI</Tag>
    : <InfoCircleOutlined className='mg1r' />

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
    window.store.rightPanelPinned = !window.store.rightPanelPinned
  }

  const panelProps = {
    className: 'right-side-panel animate-fast' + (rightPanelPinned ? ' right-side-panel-pinned' : ''),
    ref: panelRef,
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
      <Flex
        className='right-panel-title pd2'
        justify='space-between'
        align='center'
      >
        <Typography.Text level={4} ellipsis style={{ margin: 0, flex: 1 }}>
          {tag} {title}
        </Typography.Text>
        <Flex>
          <PushpinOutlined
            {...pinProps}
          />
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
