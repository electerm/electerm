export default function onDrop (e, cls) {
  e.preventDefault()
  const { store } = window
  const idDragged = e.dataTransfer.getData('idDragged')
  const tar = cls ? e.target.closest(cls) : e.target
  const idDrop = tar.getAttribute('data-id')
  store.adjustOrder('quickCommands', idDragged, idDrop)
}
