import { Component } from 'react'

/**
 * Error boundary for locally lazy-loaded components.
 *
 * A failed chunk fetch (stale chunk after a web-app redeploy, flaky network)
 * throws during render. Without a boundary like this one the error bubbles to
 * the root ErrorBoundary in `main/index.jsx`, which swaps the *whole* app —
 * every open terminal/ssh tab included — for the error page. Far too much
 * collateral for one small chunk that failed to load.
 *
 * Renders nothing when the child failed to load, reports the error through the
 * app's notification, and lets the caller react (e.g. release a mount latch so
 * the next request retries).
 *
 * Note: `React.lazy` caches a rejected `import()` forever, so retrying needs a
 * *new* lazy component — see `text-editor-entry.jsx` for the `useMemo` version.
 */
export default class LazyBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError () {
    return { failed: true }
  }

  componentDidCatch (error) {
    window.store.onError(error)
    this.props.onError?.(error)
  }

  render () {
    return this.state.failed ? null : this.props.children
  }
}
