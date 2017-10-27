
import ErrorBoundary from './error-wrapper'
import Main from './main'

export default function() {
  return (
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  )
}
