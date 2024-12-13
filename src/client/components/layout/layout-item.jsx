export default function LayoutItem (props) {
  const {
    children,
    i,
    batch,
    ...itemProps
  } = props
  function handleClick (e) {
    let currentElement = e.target
    while (currentElement) {
      if (currentElement.classList && currentElement.classList.contains('tabs-dd-icon')) {
        return false
      }
      currentElement = currentElement.parentElement
    }
    window.store.currentLayoutBatch = i
  }

  function getDom () {
    return document.querySelector(`.layout-item.v${batch + 1}`)
  }

  function onDrop (e) {
    e.preventDefault()
    const { target } = e
    if (!target) {
      return
    }
    let currentElement = target
    while (currentElement) {
      if (currentElement.classList && currentElement.classList.contains('tab')) {
        return
      }
      currentElement = currentElement.parentElement
    }
    // debug('target drop', target)
    const fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
    const onDropElem = getDom
    if (!onDropElem || !fromTab || fromTab.batch === batch) {
      return
    }
    const { store } = window
    const { tabs } = store
    const t = tabs.find(t => t.id === fromTab.id)
    if (!t) {
      return
    }
    t.batch = batch
    store.setTabs(tabs)
    clearCls()
  }

  function clearCls () {
    getDom()?.classList.remove('drag-over')
  }

  function addCls () {
    getDom()?.classList.add('drag-over')
  }

  function onDragEnter () {
    addCls()
  }

  function onDragLeave (e) {
    clearCls()
  }

  function onDragEnd (e) {
    clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }
  return (
    <div
      {...itemProps}
      onClick={handleClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {children}
    </div>
  )
}
