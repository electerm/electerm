import { useCallback } from 'react'
import DragHandle from '../common/drag-handle'

export default function SidePanel (props) {
  const onDragEnd = useCallback((nw) => {
    props.setLeftSidePanelWidth(nw)
    window.store.onResize()
  }, [props])

  const onDragMove = useCallback((nw) => {
    const el = document.getElementById('side-panel')
    el.style.width = nw + 'px'
    const el1 = document.querySelector('.sessions')
    if (el1) {
      el1.style.left = (nw + 43) + 'px'
    }
  }, [props.leftSidebarWidth])
  const dragProps = {
    min: 343,
    max: 600,
    width: props.leftSidebarWidth,
    onDragEnd,
    onDragMove,
    left: true
  }
  return (
    <div
      {...props.sideProps}
      id='side-panel'
      draggable={false}
    >
      <DragHandle
        {...dragProps}
      />
      {props.children}
    </div>
  )
}
