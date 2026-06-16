import { lazy, Suspense } from 'react'

const TextEditor = lazy(() => import('./text-editor'))

export default function TextEditorEntry (props) {
  return (
    <Suspense fallback={null}>
      <TextEditor {...props} />
    </Suspense>
  )
}
