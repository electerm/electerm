import { useEffect } from 'react'

export default function AppDrag (props) {
  function canOperate (e) {
    const {
      target
    } = e
    const { classList = [] } = target || {}
    if (
      !classList.contains('app-drag') &&
      !classList.contains('tabs-inner') &&
      !classList.contains('tabs-wrapper')
    ) {
      window.pre.runSync('windowMove', false)
      return false
    }
    return true
  }

  function onMouseDown (e) {
    // e.stopPropagation()
    if (canOperate(e)) {
      window.pre.runSync('windowMove', true)
    }
  }

  function onMouseUp (e) {
    window.pre.runSync('windowMove', false)
  }

  function onDoubleClick (e) {
    e.stopPropagation()
    if (!canOperate(e)) {
      return
    }
    const {
      isMaximized
    } = window.store
    if (isMaximized) {
      window.pre.runGlobalAsync('unmaximize')
    } else {
      window.pre.runGlobalAsync('maximize')
    }
  }

  useEffect(() => {
    window.addEventListener('contextmenu', onMouseUp)
  }, [])
  return (
    <div
      className='app-drag'
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      {props.children}
    </div>
  )
}
