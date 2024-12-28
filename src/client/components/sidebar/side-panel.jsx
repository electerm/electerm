import { useCallback, useRef } from 'react'

export default function SidePanel (props) {
  const dragStartRef = useRef(false)
  const clientXRef = useRef(0)

  const handleMousedown = useCallback((e) => {
    e.stopPropagation()
    dragStartRef.current = true
    clientXRef.current = e.clientX
    window.addEventListener('mouseup', handleMouseup)
    window.addEventListener('mousemove', handleMousemove)
  }, [])

  const handleMouseup = useCallback((e) => {
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

  return (
    <div
      {...props.sideProps}
      id='side-panel'
      draggable={false}
    >
      <div
        className='drag-handle'
        onMouseDown={handleMousedown}
        draggable={false}
      />
      {props.children}
    </div>
  )
}
