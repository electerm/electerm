/**
 * lazy entry for shortcut-bar.
 *
 * The bar only makes sense on touch devices (it exists to compensate for the
 * lack of a physical keyboard when the system input panel is shown). On
 * non-touch devices we render nothing AND never import the real component, so
 * its code (and the antd/icon deps it pulls in) stays out of the main bundle.
 */

import { lazy, Suspense } from 'react'

const ShortcutBar = lazy(() => import('./shortcut-bar'))

export function isTouchDevice () {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }
  const coarse = typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 ||
    ('ontouchstart' in window)
  return Boolean(coarse || hasTouch)
}

export default function ShortcutBarEntry (props) {
  if (!isTouchDevice()) {
    return null
  }
  return (
    <Suspense fallback={null}>
      <ShortcutBar {...props} />
    </Suspense>
  )
}
