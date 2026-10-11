/**
 * footer chip for the quick command running in the active tab, with a
 * stop button
 */
import { useRef, useLayoutEffect } from 'react'
import { auto } from 'manate/react'
import { LoadingOutlined, BorderOutlined } from '@ant-design/icons'
import translateOr from '../../common/translate-fallback'
import './qm.styl'

// CSS can't animate a width that follows the text, so when the text
// changes, set the old width, then the new one, and let the transition run
function useWidthTransition (ref, text) {
  const last = useRef(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      last.current = 0
      return
    }
    el.style.transition = 'none'
    el.style.width = ''
    const from = last.current
    const to = el.getBoundingClientRect().width
    last.current = to
    if (!from || Math.abs(from - to) < 1) {
      el.style.transition = ''
      return
    }
    el.style.width = from + 'px'
    // read the layout so the browser starts from the old width
    el.getBoundingClientRect()
    el.style.transition = ''
    el.style.width = to + 'px'
  }, [text])
}

function clearWidth (ev) {
  if (ev.target === ev.currentTarget && ev.propertyName === 'width') {
    ev.currentTarget.style.width = ''
  }
}

export default auto(function QmRunStatus ({ store }) {
  const chipRef = useRef(null)
  const run = store.runningQuickCommands[store.activeTabId]
  const progress = run ? `${Math.min(run.index + 1, run.total)}/${run.total}` : ''
  const waiting = run?.waitFor
    ? `${translateOr('waitingFor', 'Waiting for')} "${run.waitFor}"`
    : ''
  useWidthTransition(chipRef, run ? [run.name, progress, waiting, run.count].join('\n') : '')
  if (!run) {
    return null
  }
  return (
    <div className='terminal-footer-unit terminal-footer-qm-run'>
      <span
        className='qm-run-chip'
        ref={chipRef}
        onTransitionEnd={clearWidth}
        title={waiting ? `${run.name}: ${waiting}` : run.name}
      >
        <span className='qm-run-info'>
          <LoadingOutlined className='mg1r' />
          <span className='elli qm-run-name'>{run.name}</span>
          <span className='mg1l'>{progress}</span>
          {waiting ? <span key={waiting} className='mg1l elli qm-run-wait'>{waiting}</span> : null}
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
