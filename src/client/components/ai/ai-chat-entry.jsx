import { lazy, Suspense, useState } from 'react'
import LazyBoundary from '../common/lazy-boundary'

const AIChat = lazy(() => import('./ai-chat'))

export default function AIChatEntry (props) {
  const [activated, setActivated] = useState(false)
  const active = props.rightPanelTab === 'ai'
  if (active && !activated) setActivated(true)
  // Keep drafts and attachments when switching to info after opening chat.
  if (!active && !activated) return null

  return (
    <LazyBoundary>
      <Suspense fallback={null}>
        <AIChat {...props} />
      </Suspense>
    </LazyBoundary>
  )
}
