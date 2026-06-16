import { lazy, Suspense } from 'react'

const TerminalInfo = lazy(() => import('./terminal-info'))

export default function TerminalInfoEntry (props) {
  return (
    <Suspense fallback={null}>
      <TerminalInfo {...props} />
    </Suspense>
  )
}
