/**
 * pick the terminals to run a quick command in, with the same picker the
 * command history uses
 */
import { auto } from 'manate/react'
import MultiTabRunModal from '../footer/multi-tab-run-modal'
import translateOr from '../../common/translate-fallback'

export default auto(function QmRunInTabs ({ store }) {
  const id = store.qmRunInTabsId
  const qm = id && store.currentQuickCommands.find(q => q.id === id)
  if (!qm) {
    return null
  }
  const count = (qm.commands || []).length || 1
  const preview = (
    <>
      <b>{qm.name}</b>
      <span className='mg1l'>({count} {translateOr('steps', 'Steps').toLowerCase()})</span>
    </>
  )
  function handleClose () {
    window.store.qmRunInTabsId = ''
  }
  return (
    <MultiTabRunModal
      store={store}
      preview={preview}
      onRun={tabIds => window.store.runQuickCommandItem(qm.id, tabIds)}
      onClose={handleClose}
    />
  )
})
