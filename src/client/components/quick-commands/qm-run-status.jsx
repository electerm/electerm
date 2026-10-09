/**
 * footer chip for the quick command running in the active tab, with a
 * stop button
 */
import { auto } from 'manate/react'
import { LoadingOutlined, BorderOutlined } from '@ant-design/icons'
import translateOr from '../../common/translate-fallback'
import './qm.styl'

export default auto(function QmRunStatus ({ store }) {
  const run = store.runningQuickCommands[store.activeTabId]
  if (!run) {
    return null
  }
  const progress = `${Math.min(run.index + 1, run.total)}/${run.total}`
  return (
    <div className='terminal-footer-unit terminal-footer-qm-run'>
      <span className='qm-run-chip' title={run.name}>
        <span className='qm-run-info'>
          <LoadingOutlined className='mg1r' />
          <span className='elli qm-run-name'>{run.name}</span>
          <span className='mg1l'>{progress}</span>
          {run.count > 1 ? <span className='mg1l'>+{run.count - 1}</span> : null}
        </span>
        <span
          className='pointer qm-run-stop'
          title={translateOr('stopQuickCommand', 'Stop quick command')}
          onClick={() => store.stopQuickCommand(store.activeTabId)}
        >
          <BorderOutlined className='mg1r' />
          {translateOr('stop', 'Stop')}
        </span>
      </span>
    </div>
  )
})
