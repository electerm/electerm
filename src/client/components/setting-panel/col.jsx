/**
 * two column layout, left column user-resizable, right column auto width
 */

import { useState, useRef } from 'react'
import Placeholder from '../common/placeholder'
import DragHandle from '../common/drag-handle'
import * as ls from '../../common/safe-local-storage'

const widthKey = 'setting-list-col-width'
const defaultWidth = 340
// Below this the toolbar icons above the list start getting clipped.
const minWidth = 300
const maxWidth = 700

export default function SettingCol (props) {
  // Clamp on read too, not just on write: a width stored before the bounds
  // changed would otherwise come back out of range.
  const [width, setWidth] = useState(() => {
    const stored = parseInt(ls.getItem(widthKey), 10)
    if (!stored) {
      return defaultWidth
    }
    return Math.min(maxWidth, Math.max(minWidth, stored))
  })

  // antd's Splitter fires onResize during its initial layout, and DragHandle
  // forwards that to onDragEnd -- which would persist a width the user never
  // chose. Only accept a value once a pointer has actually gone down on the
  // grip.
  const dragging = useRef(false)

  function onPointerDown () {
    dragging.current = true
  }

  function onDragEnd (nw) {
    if (!dragging.current) {
      return
    }
    const v = Math.round(nw)
    if (v < minWidth || v > maxWidth) {
      return
    }
    setWidth(v)
    ls.setItem(widthKey, v)
  }

  // Both columns derive from --list-col-width, so setting it here moves the
  // divider and the detail pane together. One value for every tab.
  const style = {
    '--list-col-width': width + 'px'
  }

  return (
    <div className='setting-col' style={style}>
      <div className='setting-row setting-row-left'>
        <div onPointerDown={onPointerDown}>
          <DragHandle
            min={minWidth}
            max={maxWidth}
            width={width}
            onDragEnd={onDragEnd}
            left
          />
        </div>
        {props.children[0]}
      </div>
      <div
        className='setting-row setting-row-right'
      >
        <div className='setting-col-content'>
          {props.children[1]}
        </div>
        <div className='setting-col-placeholder'>
          <Placeholder />
        </div>
      </div>
    </div>
  )
}
