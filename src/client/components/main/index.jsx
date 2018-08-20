
import ErrorBoundary from './error-wrapper'
import Init from './init'

export default function() {
  return (
    <ErrorBoundary>
      <Init />
    </ErrorBoundary>
  )
}
