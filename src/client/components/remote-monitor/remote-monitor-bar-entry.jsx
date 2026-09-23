import { lazy, Suspense } from 'react'
import { auto } from 'manate/react'
import { isRemoteMonitorBarVisible } from './visibility'
import LazyBoundary from '../common/lazy-boundary'

const RemoteMonitorBar = lazy(() => import('./remote-monitor-bar'))

export default auto(function RemoteMonitorBarEntry (props) {
  if (!isRemoteMonitorBarVisible(props.store)) return null

  return (
    <LazyBoundary>
      <Suspense fallback={null}>
        <RemoteMonitorBar {...props} />
      </Suspense>
    </LazyBoundary>
  )
})
