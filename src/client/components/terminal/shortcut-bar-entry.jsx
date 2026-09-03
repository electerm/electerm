/**
 * lazy entry for shortcut-bar.
 *
 * The bar compensates for the missing physical keyboard while the system
 * input panel (on-screen keyboard) is shown over a terminal. Capability
 * probes like `(pointer: coarse)` / `maxTouchPoints` are unreliable here —
 * remote-control clients and some touch-capable laptops report touch even
 * though tapping the terminal never brings up a soft keyboard.
 *
 * So instead of guessing, we react to the real signal: the soft keyboard
 * shrinking `window.visualViewport`. Until that is observed we render nothing
 * AND never import the real component, so its code (and the antd/icon deps it
 * pulls in) stays out of the main bundle on every device that doesn't
 * actually show a keyboard.
 *
 * Detection is cross-platform:
 *   - visualViewport.height always reflects the *visible* area and shrinks
 *     when the keyboard opens on BOTH iOS and Android.
 *   - the layout viewport (window.innerHeight) is what differs: iOS keeps it
 *     fixed, Android resizes it too — so the naive innerHeight−visualViewport
 *     gap works on iOS but is ~0 on Android. We therefore compare
 *     visualViewport.height against a baseline captured at the moment the
 *     terminal input is focused (i.e. before the keyboard opens), which holds
 *     the full pre-keyboard height on both platforms.
 *
 * Telling a keyboard from a desktop window resize (pure size heuristics
 * fail — dragging a window's top/bottom edge is also a height-only shrink)
 * needs one of two extra signals, checked in onResize:
 *   - an overlay-style keyboard (iOS / HarmonyOS) shrinks the visual
 *     viewport but keeps the layout viewport (window.innerHeight) full —
 *     a window resize shrinks both.
 *   - an Android-style keyboard resizes both viewports, but a soft keyboard
 *     only ever opens in response to a *touch* into the terminal — a window
 *     resized with a mouse never shows one.
 * Tablets running the desktop program still get the bar; mouse-driven
 * desktops never do.
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { auto } from 'manate/react'

const ShortcutBar = lazy(() => import('./shortcut-bar'))

// minimum height (px) the visual viewport must lose for us to treat it as
// "the soft keyboard is now covering part of the screen". A soft keyboard is
// typically ≥150px; a browser address-bar show/hide is well under this.
// Shared with shortcut-bar.jsx, which uses it to decide how far to lift the
// bar above a keyboard that overlays the page (iOS / HarmonyOS).
export const KEYBOARD_MIN = 120

// how long (ms) after an in-page touch an Android-style (layout-resizing)
// keyboard is expected to be up. Bounds the touch signal used to tell that
// keyboard from a mouse-driven window resize on touch-capable desktops.
const TOUCH_GRACE_MS = 3000

function ShortcutBarEntry (props) {
  const { store } = props
  // opt out entirely when the user has disabled the shortcut bar in common
  // settings — bail before any listener is attached or component imported.
  const disabled = store.config.disableShortcutBar
  // follow the store's live touch state (flipped by main.jsx from real
  // pointer input — mouse → false, touch/pen → true) instead of probing screen
  // capability, which only says the screen *can* be touched, not whether the
  // user is actually using touch, so the bar reacts when a touch-capable
  // machine starts being used by touch.
  const isTouch = store.isTouchDevice
  // very old runtimes expose no visualViewport — the lazy "wait for a real
  // keyboard" signal below can never fire there, so fall back straight to the
  // touch state.
  const noVisualViewport = typeof window === 'undefined' || !window.visualViewport
  const [keyboardSeen, setKeyboardSeen] = useState(() => {
    if (noVisualViewport) {
      return !disabled && isTouch
    }
    return false
  })

  // keep the no-visualViewport fallback current as the store's touch state
  // flips at runtime; on modern engines keyboardSeen is driven by the resize
  // listener below and this never runs.
  useEffect(() => {
    if (noVisualViewport) {
      setKeyboardSeen(!disabled && isTouch)
    }
  }, [disabled, isTouch, noVisualViewport])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      return
    }
    // baseline = the visual viewport captured the last time focus moved into a
    // terminal. The keyboard opens *after* that focus, so this baseline holds
    // the pre-keyboard (full) size, and the subsequent resize lets us measure
    // exactly how much the keyboard took — on both iOS and Android.
    let baseline = { height: vv.height, width: vv.width }
    // when the last in-page touch happened (0 = never). An Android-style
    // keyboard resizes the layout viewport exactly like a window resize does,
    // so size alone can't separate them there — but a keyboard only ever
    // opens right after a *touch*, while a window drag doesn't fire in-page
    // pointer events at all, so an old touch must not count forever.
    let lastTouchAt = 0

    function onFocusIn (ev) {
      const el = ev.target
      if (el && el.closest && el.closest('.term-wrap')) {
        baseline = { height: vv.height, width: vv.width }
      }
    }

    function onPointerDown (ev) {
      // touch or stylus — both tap like a finger and can raise the keyboard
      if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
        lastTouchAt = Date.now()
      }
    }

    function onResize () {
      // ignore viewport changes that also changed width (rotation / split) —
      // a keyboard changes height only.
      const sameWidth = Math.abs(vv.width - baseline.width) < 20
      if (!sameWidth || baseline.height - vv.height <= KEYBOARD_MIN) {
        return
      }
      // overlay keyboard (iOS / HarmonyOS): the layout viewport stays full
      // while the visual one shrinks. A window resize shrinks both — this is
      // what rules out mouse window-dragging on those platforms.
      const layoutShrunk = window.innerHeight < baseline.height - KEYBOARD_MIN
      if (!layoutShrunk) {
        setKeyboardSeen(true)
        // The user is focused in a terminal with the keyboard up — they need
        // the bar right now. Set visibility here rather than waiting for the
        // focus/pointer listener inside the (just-mounted) ShortcutBar, which
        // would otherwise miss the focusin that already fired before it
        // mounted — leaving the bar's reserved space empty until a 2nd tap.
        const { store } = window
        if (store && store.inActiveTerminal) {
          store.shortcutBarVisible = true
        }
        return
      }
      // Android-style resize keyboard: both viewports shrink, so require a
      // recent touch — a keyboard opens within moments of the tap, while a
      // window drag fires no in-page pointerdown at all, so any touch old
      // enough to have expired can't have been the cause.
      if (Date.now() - lastTouchAt < TOUCH_GRACE_MS) {
        setKeyboardSeen(true)
        const { store } = window
        if (store && store.inActiveTerminal) {
          store.shortcutBarVisible = true
        }
      }
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('pointerdown', onPointerDown)
    vv.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerdown', onPointerDown)
      vv.removeEventListener('resize', onResize)
    }
  }, [])

  if (disabled || !keyboardSeen) {
    return null
  }
  return (
    <Suspense fallback={null}>
      <ShortcutBar {...props} />
    </Suspense>
  )
}

export default auto(ShortcutBarEntry)
