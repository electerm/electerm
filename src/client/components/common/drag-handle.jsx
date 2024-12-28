import { useCallback, useRef, useState } from 'react'
import './drag-handle.styl'

export default function SidePanel (props) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef(false)
  const clientXRef = useRef(0)

  const handleMousedown = useCallback((e) => {
    e.stopPropagation()
    setIsDragging(true)
    dragStartRef.current = true
    clientXRef.current = e.clientX
    window.addEventListener('mouseup', handleMouseup)
    window.addEventListener('mousemove', handleMousemove)
  }, [])

  const handleMouseup = useCallback((e) => {
    setIsDragging(false)
    dragStartRef.current = false
    const clientX = e.clientX
    let nw = clientX - clientXRef.current + props.leftSidebarWidth
    if (nw < 150) {
      nw = 150
    } else if (nw > 600) {
      nw = 600
    }
    props.setLeftSidePanelWidth(nw)
    window.store.onResize()
    window.removeEventListener('mouseup', handleMouseup)
    window.removeEventListener('mousemove', handleMousemove)
  }, [props])

  const handleMousemove = useCallback((e) => {
    const clientX = e.clientX
    const el = document.getElementById('side-panel')
    let nw = clientX - clientXRef.current + props.leftSidebarWidth
    if (nw < 343) {
      nw = 343
    } else if (nw > 600) {
      nw = 600
    }
    el.style.width = nw + 'px'
    const el1 = document.querySelector('.sessions')
    if (el1) {
      el1.style.left = (nw + 43) + 'px'
    }
  }, [props.leftSidebarWidth])
  const divProps = {
    className: 'drag-handle' + (isDragging ? ' dragging' : ''),
    onMouseDown: handleMousedown,
    draggable: false
  }
  return (
    <div
      {...divProps}
    />
  )
}
