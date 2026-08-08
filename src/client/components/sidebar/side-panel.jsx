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
    min: 343,
    max: 600,
    width: props.leftSidePanelWidth,
    onDragEnd,
    onDragMove,
    left: true
  }
  return (
    <div
      {...props.sideProps}
      ref={panelRef}
      draggable={false}
    >
      <DragHandle
        {...dragProps}
      />
      {props.children}
    </div>
  )
}
