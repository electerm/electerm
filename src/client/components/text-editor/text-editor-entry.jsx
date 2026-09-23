import { lazy, Suspense, useMemo } from 'react'
import LazyBoundary from '../common/lazy-boundary'

export default function TextEditorEntry (props) {
  // one lazy component per mount: the entry is remounted (the mount latch is
  // released by the boundary below) exactly when a previous load failed, and
  // React.lazy caches a rejected import() forever — so a retry has to go
  // through a *new* lazy component
  const TextEditor = useMemo(() => lazy(() => import('./text-editor')), [])
  const onError = () => {
    // release the mount latch so the next "edit file" request mounts a fresh
    // lazy component and retries the fetch
    window.store.textEditorRequested = false
  }
  return (
    <LazyBoundary onError={onError}>
      <Suspense fallback={null}>
        <TextEditor {...props} />
      </Suspense>
    </LazyBoundary>
  )
}
