import { lazy, Suspense } from 'react'

const AIChat = lazy(() => import('./ai-chat'))

export default function AIChatEntry (props) {
  return (
    <Suspense fallback={null}>
      <AIChat {...props} />
    </Suspense>
  )
}
