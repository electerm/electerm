import ErrorBoundary from './error-wrapper'
import Login from '../auth/login'

export default function MainEntry () {
  return (
    <ErrorBoundary>
      <Login />
    </ErrorBoundary>
  )
}
