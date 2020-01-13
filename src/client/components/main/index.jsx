
import ErrorBoundary from './error-wrapper'
import Main from './main'
import store from '../../store'

export default function () {
  return (
    <ErrorBoundary>
      <Main store={store} />
    </ErrorBoundary>
  )
}
