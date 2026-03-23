import { useEffect, useRef } from 'react'
import shouldUseSystemTitleBar from '../../common/should-use-system-title-bar'

export default function AppDrag (props) {
  const isDraggingRef = useRef(false)
  const useSystemTitleBar = shouldUseSystemTitleBar(window.store?.config)

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

  useEffect(() => {
    if (useSystemTitleBar) {
      return
    }
    if (window.store.shouldSendWindowMove) {
      return
    }
    document.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onMouseUp)

    return () => {
      document.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onMouseUp)
    }
  }, [useSystemTitleBar])

  if (useSystemTitleBar) {
    return props.children || null
  }

  function onMouseDown (e) {
    // e.stopPropagation()
    if (canOperate(e)) {
      isDraggingRef.current = true
      window.pre.runSync('windowMove', true)
    }
  }

  function onMouseUp (e) {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      window.pre.runSync('windowMove', false)
    }
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
  const props0 = {
    className: 'app-drag',
    onDoubleClick
  }
  if (
    window.store.shouldSendWindowMove
  ) {
    Object.assign(props0, {
      onMouseDown,
      onMouseUp
    })
  } else {
    props0.style = {
      WebkitAppRegion: 'drag'
    }
  }
  return (
    <div
      {...props0}
    >
      {props.children}
    </div>
  )
}
