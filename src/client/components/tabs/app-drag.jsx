export default function AppDrag (props) {
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

  // Every window electerm draws its own title bar for is either frameless
  // (macOS/Linux) or a Windows window with the controls overlay; both have a
  // native drag region, so the OS handles the drag here.
  const props0 = {
    className: 'app-drag',
    onDoubleClick,
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
