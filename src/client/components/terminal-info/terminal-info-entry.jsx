import { lazy, Suspense } from 'react'
import importRetry from '../../common/import-retry'

const TerminalInfo = lazy(() => importRetry(() => import('./terminal-info')))

export default function TerminalInfoEntry (props) {
  return (
    <Suspense fallback={null}>
      <TerminalInfo {...props} />
    </Suspense>
  )
}
