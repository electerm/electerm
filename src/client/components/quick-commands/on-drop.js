export default function onDrop (e, cls) {
  e.preventDefault()
  const { store } = window
  const { quickCommands } = store
  const idDragged = e.dataTransfer.getData('idDragged')
  const tar = cls ? e.target.closest(cls) : e.target
  const idDrop = tar.getAttribute('data-id')
  const idDraggedIndex = quickCommands.findIndex(
    ({ id }) => id === idDragged
  )
  const targetIndex = quickCommands.findIndex(
    ({ id }) => id === idDrop
  )
  if (idDraggedIndex !== targetIndex) {
    const [removed] = quickCommands.splice(idDraggedIndex, 1)
    quickCommands.splice(targetIndex, 0, removed)
    store.setItems('quickCommands', quickCommands)
  }
}
