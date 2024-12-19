export default function onDrop (e, batch, onDropElem) {
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
  const fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
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
}
