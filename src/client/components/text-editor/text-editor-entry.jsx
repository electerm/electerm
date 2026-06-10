import { lazy, Suspense } from 'react'
import importRetry from '../../common/import-retry'

const TextEditor = lazy(() => importRetry(() => import('./text-editor')))

export default function TextEditorEntry (props) {
  return (
    <Suspense fallback={null}>
      <TextEditor {...props} />
    </Suspense>
  )
}
