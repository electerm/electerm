import { useCallback, useRef, useState, memo } from 'react'
import './drag-handle.styl'

export default memo(function DragHandle (props) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef(false)
  const clientXRef = useRef(0)
  const {
    max,
    min,
    width,
    left = true
  } = props

  const calc = useCallback((clientX) => {
    let nw = left
      ? clientX - clientXRef.current + width
      : clientXRef.current - clientX + width
    if (nw < min) {
      nw = min
    } else if (nw > max) {
      nw = max
    }
    return nw
  }, [props.max, props.min, props.left])

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
    const nw = calc(e.clientX)
    props.onDragEnd(nw)
    window.store.onResize()
    window.removeEventListener('mouseup', handleMouseup)
    window.removeEventListener('mousemove', handleMousemove)
  }, [])

  const handleMousemove = useCallback((e) => {
    const nw = calc(e.clientX)
    props.onDragMove(nw)
  }, [width])
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
})
