import { lazy, Suspense } from 'react'
import importRetry from '../../common/import-retry'

const AIChat = lazy(() => importRetry(() => import('./ai-chat')))

export default function AIChatEntry (props) {
  return (
    <Suspense fallback={null}>
      <AIChat {...props} />
    </Suspense>
  )
}
