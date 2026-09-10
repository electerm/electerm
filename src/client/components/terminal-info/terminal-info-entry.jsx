import { lazy, Suspense } from 'react'
import { auto } from 'manate/react'
import { getRemoteMonitorTab } from '../remote-monitor/visibility'
import LazyBoundary from '../common/lazy-boundary'

const TerminalInfo = lazy(() => import('./terminal-info'))

export default auto(function TerminalInfoEntry (props) {
  const tab = getRemoteMonitorTab(props.store)
  if (props.store.rightPanelTab !== 'info' || props.pid !== tab?.id) return null

  return (
    <LazyBoundary>
      <Suspense fallback={null}>
        <TerminalInfo {...props} />
      </Suspense>
    </LazyBoundary>
  )
})
