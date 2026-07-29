import { isDropAfterHalf } from '../../common/drop-position'

export default function onDrop (e, cls) {
  e.preventDefault()
  const { store } = window
  const idDragged = e.dataTransfer.getData('idDragged')
  const tar = cls ? e.target.closest(cls) : e.target
  const idDrop = tar.getAttribute('data-id')
  // drop on the bottom half of the target => insert after it,
  // which makes dropping on the last item append to the end.
  const insertAfter = isDropAfterHalf(e, tar)
  store.adjustOrder('quickCommands', idDragged, idDrop, insertAfter)
}
