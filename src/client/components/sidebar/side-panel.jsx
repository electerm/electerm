import { useCallback, useRef } from 'react'
import DragHandle from '../common/drag-handle'

export default function SidePanel (props) {
  const panelRef = useRef(null)

  const onDragEnd = useCallback((nw) => {
    props.setLeftSidePanelWidth(nw)
    window.store.onResize()
  }, [props])

  const onDragMove = useCallback((nw) => {
    if (panelRef.current) {
      panelRef.current.style.width = nw + 'px'
    }
    const el1 = document.querySelector('.sessions')
    if (el1) {
      el1.style.left = (nw + props.leftSideBarWidth) + 'px'
    }
  }, [props.leftSidePanelWidth, props.leftSideBarWidth])
  const dragProps = {
    min: 200,
    max: 600,
    width: props.leftSidePanelWidth,
    onDragEnd,
    onDragMove,
    left: true
  }
  // Mobile panels are full-screen drawers: the width is the viewport and is not
  // adjustable, so the resize handle is not rendered at all — a handle there
  // would sit on the screen edge and drag a size the panel does not use (see
  // store.leftSidePanelWidth, which ignores the stored width on mobile).
  const dragHandle = props.isMobile
    ? null
    : <DragHandle {...dragProps} />
  return (
    <div
      {...props.sideProps}
      ref={panelRef}
      draggable={false}
    >
      {dragHandle}
      {props.children}
    </div>
  )
}
