import { useEffect, useRef } from 'react'

export default function AppDrag (props) {
  const refreshFrame = useRef(null)

  useEffect(() => () => {
    if (refreshFrame.current !== null) {
      window.cancelAnimationFrame(refreshFrame.current)
    }
  }, [])

  function canOperate (e) {
    const {
      target
    } = e
    const { classList = [] } = target || {}
    return classList.contains('app-drag') ||
      classList.contains('tabs-inner') ||
      classList.contains('tabs-wrapper')
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

  function onMouseMove (e) {
    if (!window.store?.isWindowControlsOverlay ||
      refreshFrame.current !== null || !canOperate(e)) {
      return
    }
    // Native drag regions swallow mouse events. Receiving one over an empty
    // titlebar area means Windows has lost that region. Re-register it across
    // two frames so Chromium sends both the removal and the restored region.
    const area = e.currentTarget
    area.style.WebkitAppRegion = 'no-drag'
    refreshFrame.current = requestAnimationFrame(() => {
      refreshFrame.current = requestAnimationFrame(() => {
        area.style.WebkitAppRegion = 'drag'
        refreshFrame.current = null
      })
    })
  }

  // Every window electerm draws its own title bar for is either frameless
  // (macOS/Linux) or a Windows window with the controls overlay; both have a
  // native drag region, so the OS handles the drag here.
  const props0 = {
    className: 'app-drag',
    onDoubleClick,
    onMouseMove,
    style: {
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
