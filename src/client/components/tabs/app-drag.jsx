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
      return false
    }
    return true
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
  return (
    <div
      className='app-drag'
      onDoubleClick={onDoubleClick}
    >
      {props.children}
    </div>
  )
}
