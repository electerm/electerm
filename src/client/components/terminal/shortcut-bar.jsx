/**
 * shortcut-bar
 *
 * On touch devices, tapping a terminal pops the system input panel.
 * Without a physical keyboard, modifier / function keys are hard to type, so
 * this renders a slim, horizontally-scrollable bar pinned just outside the
 * page content (its space is reserved by layout.jsx, so it never overlaps the
 * terminal, footer or any other UI).
 *
 *   - first (fixed) button collapses the bar
 *   - second (fixed) button opens the edit modal (shortcut-bar-edit.jsx)
 *   - tapping a shortcut sends it to the active terminal via runQuickCommand
 *   - pressing AND holding one repeats it, like a physical key: a tap has to
 *     send exactly one key, but holding Bksp to erase a word or ↓ to walk
 *     back through the scrollback is impossible without auto-repeat. The
 *     timing lives in shortcut-bar-press.js
 *   - while the system input panel overlays the page without resizing the
 *     layout viewport (iOS / HarmonyOS do this, Android resizes instead), the
 *     bar lifts itself above the panel — see the visualViewport effect below
 *
 * Only loaded on touch devices — see shortcut-bar-entry.jsx.
 * Data + persistence live in shortcut-bar-defs.js.
 */

import { auto } from 'manate/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DownOutlined, EditOutlined } from '@ant-design/icons'
import { refs } from '../common/ref'
import { shortcutBarHeight } from '../../common/constants'
import ShortcutBarEdit from './shortcut-bar-edit'
import { KEYBOARD_MIN } from './shortcut-bar-entry'
import { candidates, loadActive, saveActive, ESC } from './shortcut-bar-defs'
import { createKeyRepeat } from './shortcut-bar-press'
import './shortcut-bar.styl'

const e = window.translate

// Arrow / Home / End keys have two wire forms: the normal CSI form (ESC [ x)
// and the application SS3 form (ESC O x). Which one a keypress should produce
// is decided by the terminal's DECCKM (Application Cursor Keys) state, which
// the remote program sets. Some shells accept both forms (bash/readline), but
// stricter line editors such as OpenWrt's busybox ash only recognize the form
// matching the current mode — so always sending the CSI form breaks arrow
// keys there. A real keyboard switches on the mode; this does the same.
const appCursorMap = {
  [ESC + '[A']: ESC + 'OA', // ↑
  [ESC + '[B']: ESC + 'OB', // ↓
  [ESC + '[C']: ESC + 'OC', // →
  [ESC + '[D']: ESC + 'OD', // ←
  [ESC + '[H']: ESC + 'OH', // Home
  [ESC + '[F']: ESC + 'OF' // End
}

function activeTerm () {
  const { store } = window
  return refs.get('term-' + store.activeTabId)
}

function sendToTerminal (data) {
  const term = activeTerm()
  if (term && typeof term.runQuickCommand === 'function') {
    const resolved = resolveCursorMode(data, term)
    term.runQuickCommand(resolved, true)
  }
}

// Put focus back on the terminal's helper textarea, which is the element that
// owns the soft keyboard.
//
// A press on a bar button focuses that button instead, and the OS then
// dismisses the input panel — which also drops the bar, since it rides above
// the panel, so the hold visibly breaks.
//
// Preventing the default on mousedown covers the mouse path, but Chromium only
// synthesizes those compatibility mouse events after touchend, so on touch the
// theft happens after any reclaim made during pointerdown. Hence this is also
// driven from the focusin listener in the effect below, which is timing
// independent. Called from pointerdown it still helps: it puts focus back
// before the platform has any chance to act on the button.
//
// The call is synchronous inside the user gesture, which is what a
// keyboard-showing focus() requires, and it is idempotent.
let reclaiming = false

function reclaimTerminalFocus () {
  // focus() re-raises focusin, so guard against recursing: a press that
  // repeatedly reclaims would otherwise spin.
  if (reclaiming) {
    return
  }
  const term = activeTerm()
  if (!term || !term.term || typeof term.term.focus !== 'function') {
    return
  }
  reclaiming = true
  try {
    term.term.focus()
  } finally {
    // released synchronously, once the focus() call has returned — the
    // focusin it triggers has already been dispatched by then
    reclaiming = false
  }
}

// honor the active terminal's DECCKM state for the cursor / Home / End keys.
// custom combos can be multi-key sequences (Ctrl+A then ↑), so match the
// trailing key too — not only the whole payload.
function resolveCursorMode (data, term) {
  if (!term?.term?.modes?.applicationCursorKeysMode) {
    return data
  }
  for (const normal in appCursorMap) {
    if (data === normal) {
      return appCursorMap[normal]
    }
    if (data.length > normal.length && data.endsWith(normal)) {
      return data.slice(0, data.length - normal.length) + appCursorMap[normal]
    }
  }
  return data
}

function ShortcutBar (props) {
  const { store } = props
  const [buttons, setButtons] = useState(loadActive)
  const [editing, setEditing] = useState(false)

  // show the bar whenever a terminal becomes active / gets focused,
  // hide it when the active tab is not a terminal.
  useEffect(() => {
    store.shortcutBarVisible = !!store.inActiveTerminal
  }, [store.activeTabId, store.inActiveTerminal])

  useEffect(() => {
    function onTerminalFocus (ev) {
      const el = ev.target
      if (el && el.closest && el.closest('.term-wrap')) {
        if (window.store.inActiveTerminal) {
          window.store.shortcutBarVisible = true
        }
      }
    }
    document.addEventListener('focusin', onTerminalFocus)
    document.addEventListener('pointerdown', onTerminalFocus)
    return () => {
      document.removeEventListener('focusin', onTerminalFocus)
      document.removeEventListener('pointerdown', onTerminalFocus)
    }
  }, [])

  // On Android the soft keyboard resizes the layout viewport, so a
  // `position: fixed; bottom: 0` bar is pushed up automatically. iOS and
  // HarmonyOS instead keep the layout viewport full-size and let the keyboard
  // overlay it — there the bar sits underneath the keyboard. visualViewport
  // always tracks the *visible* area on every platform, so the gap between it
  // and the layout viewport is exactly the covered height: lift the bar by
  // that much so it rides just above the keyboard.
  const [kbOffset, setKbOffset] = useState(0)
  const kbBaselineRef = useRef({ height: 0, width: 0 })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      return
    }
    // while no keyboard is up, layout viewport == visual viewport (offsetTop
    // 0); keep refreshing the baseline so a later comparison is accurate.
    function sync () {
      if (vv.offsetTop <= 1) {
        kbBaselineRef.current = { height: window.innerHeight, width: vv.width }
      }
      const { height, width } = kbBaselineRef.current
      // a keyboard changes height only — ignore rotation / pinch-zoom, which
      // change width too.
      const sameWidth = Math.abs(vv.width - width) < 20
      const covered = sameWidth ? height - vv.height - vv.offsetTop : 0
      setKbOffset(covered > KEYBOARD_MIN ? Math.ceil(covered) : 0)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  // keep the offset in a CSS var consumed by shortcut-bar.styl, and expose the
  // lifted height so layout.jsx can shrink the terminal accordingly.
  useEffect(() => {
    const offset = store.shortcutBarVisible ? kbOffset : 0
    document.documentElement.style.setProperty('--shortcut-bar-kb-offset', offset + 'px')
    store.shortcutBarKbOffset = offset
  }, [kbOffset, store.shortcutBarVisible])

  // reserve layout space + lift the footer while the bar is shown.
  // expose the bar height as a CSS var so the .styl + footer-lift rule stay
  // in sync with the shortcutBarHeight constant consumed by layout.jsx.
  useEffect(() => {
    const on = !!store.shortcutBarVisible
    document.body.classList.toggle('shortcut-bar-on', on)
    if (on) {
      document.documentElement.style.setProperty(
        '--shortcut-bar-h',
        shortcutBarHeight + 'px'
      )
    }
    return () => {
      document.body.classList.remove('shortcut-bar-on')
      document.documentElement.style.removeProperty('--shortcut-bar-h')
    }
  }, [store.shortcutBarVisible])

  function handleClose () {
    store.shortcutBarVisible = false
  }

  // edits inside the modal persist live; the modal closes via its own X button.
  function handleSave (next) {
    setButtons(next)
    saveActive(next)
  }

  // ---- press-and-hold auto-repeat ----
  // A tap is a plain click, so it stays one key. On top of that, a press that
  // is held repeats its key (see shortcut-bar-press.js) — the only way to hold
  // Bksp or an arrow key without a physical keyboard.
  const repeatRef = useRef(null)
  // id of the button currently repeating, so only it shows the pressed state
  const [repeatingId, setRepeatingId] = useState(null)
  // a long press has already sent its key(s); the click the browser fires on
  // release must not add one more. Set by the repeat, cleared once consumed.
  const swallowClickRef = useRef(false)

  if (!repeatRef.current) {
    repeatRef.current = createKeyRepeat({
      send: b => {
        if (b) {
          sendToTerminal(b.data)
        }
      },
      onRepeatChange: b => setRepeatingId(b ? b.id : null)
    })
  }

  // The gesture can end anywhere — the finger can slide off the bar, lift
  // outside the window, or the system can steal it (a callout, an incoming
  // call). A window-level release is the only net that catches all of those;
  // the per-button handler below is what keeps the common case responsive.
  useEffect(() => {
    function onGlobalRelease (ev) {
      if (repeatRef.current.up(ev)) {
        swallowClickRef.current = true
      }
    }
    function onGlobalCancel (ev) {
      // a cancelled gesture is not a long press: nothing was sent that the
      // user needs to "not double", so no click has to be swallowed
      repeatRef.current.cancel(ev)
    }
    // Catch-all for focus theft, and the reliable half of the fix.
    //
    // Reclaiming focus at pointerdown is too early to be trustworthy: Chromium
    // only synthesizes the compatibility mouse events (mousedown/mouseup/click)
    // AFTER touchend, so on the touch path the button takes focus *after* the
    // press has already reclaimed it. Timing the reclaim per-event cannot cover
    // that; reacting to focus itself can, and it covers every path — mouse,
    // touch, the compatibility mousedown, and the context-menu focus grab.
    //
    // focusin rather than focus: it bubbles, so one listener on the window sees
    // the bar's buttons from outside the portal.
    //
    // The guard is what keeps this from looping: only focus landing inside this
    // bar is reclaimed, and not when it is the reclaim's own doing.
    function onFocusIn (ev) {
      const el = ev.target
      if (!el || !el.closest || !el.closest('.shortcut-bar')) {
        return
      }
      if (reclaiming) {
        return
      }
      reclaimTerminalFocus()
    }
    window.addEventListener('pointerup', onGlobalRelease)
    window.addEventListener('pointercancel', onGlobalCancel)
    window.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('pointerup', onGlobalRelease)
      window.removeEventListener('pointercancel', onGlobalCancel)
      window.removeEventListener('focusin', onFocusIn)
      // unmount (or the bar going away) must not leave a timer running
      repeatRef.current.dispose()
    }
  }, [])

  // the bar hiding mid-hold is a cancel, not a release: the keys already sent
  // stand, and no stale click may be swallowed by the next one
  useEffect(() => {
    if (!store.shortcutBarVisible) {
      repeatRef.current.cancel()
      swallowClickRef.current = false
    }
  }, [store.shortcutBarVisible])

  function handleClick (b) {
    if (swallowClickRef.current) {
      swallowClickRef.current = false
      return
    }
    sendToTerminal(b.data)
  }

  function handlePointerDown (ev, b) {
    // a right / middle click is not a key press
    if (ev.button != null && ev.button > 0) {
      return
    }
    // The flag only has to survive from the release to the click the browser
    // synthesizes right after it. A release that lands OFF the button
    // synthesizes no click at all, so without this the flag would still be
    // armed on the next press and eat a legitimate key. Any new press starts
    // strictly after the previous click, so clearing here is safe.
    swallowClickRef.current = false
    // Only a mouse: capturing a touch pointer makes the browser scroll the
    // button row no more, and dragging the row by a button is exactly how the
    // bar is scrolled. Touch instead relies on pointercancel (fired when the
    // browser takes over for a scroll) plus the move tolerance below.
    if (ev.pointerType === 'mouse') {
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId)
      } catch (e) {
        // capture is an optimisation for cancel-on-slide-off; without it the
        // hold still stops on pointerup, just via the window-level net
      }
    }
    // before anything can steal it — see reclaimTerminalFocus()
    reclaimTerminalFocus()
    repeatRef.current.down(b, ev)
  }

  function handlePointerUp (ev) {
    if (repeatRef.current.up(ev)) {
      swallowClickRef.current = true
    }
  }

  function renderButton (b, i) {
    return (
      <button
        type='button'
        key={b.id + '-' + i}
        className={
          'shortcut-bar-btn' + (repeatingId === b.id ? ' repeating' : '')
        }
        onPointerDown={ev => handlePointerDown(ev, b)}
        onPointerMove={ev => repeatRef.current.move(ev)}
        onPointerUp={handlePointerUp}
        onClick={() => handleClick(b)}
      >
        {b.label}
      </button>
    )
  }

  if (!store.shortcutBarVisible) {
    return null
  }

  return createPortal(
    <div
      className='shortcut-bar'
      role='toolbar'
      style={kbOffset ? { bottom: kbOffset + 'px' } : undefined}
      // Keep the press from moving DOM focus in the first place.
      //
      // A button is focusable, and on a real press the browser focuses it
      // (measured: focus lands on .shortcut-bar-btn, not on the terminal's
      // helper textarea). That helper textarea is what owns the soft keyboard,
      // so on Android Chrome focus moving to a non-editable element makes the
      // OS dismiss the input panel — and the bar, which rides above the
      // panel, drops with it, so the hold visibly breaks.
      //
      // This is the preventive half (it still delivers the click, also
      // measured) and it covers the mouse path plus the compatibility mousedown
      // on the container, so the two icon buttons get it too. It cannot cover
      // the touch path on its own — those compatibility events are synthesized
      // after touchend — which is why the focusin listener above exists as the
      // reliable half.
      //
      // pointerdown is deliberately NOT prevented: that would stop the browser
      // scrolling the button row.
      onMouseDown={e => e.preventDefault()}
    >
      <div className='shortcut-bar-fixed'>
        <button
          type='button'
          className='shortcut-bar-icon-btn'
          title={e('close')}
          onClick={handleClose}
        >
          <DownOutlined />
        </button>
        <button
          type='button'
          className='shortcut-bar-icon-btn'
          title={e('edit')}
          onClick={() => setEditing(true)}
        >
          <EditOutlined />
        </button>
      </div>
      <div className='shortcut-bar-scroll'>
        {buttons.map(renderButton)}
      </div>
      {
        editing && (
          <ShortcutBarEdit
            active={buttons}
            candidates={candidates}
            isMobile={store.isMobile}
            onCancel={() => setEditing(false)}
            onSave={handleSave}
          />
        )
      }
    </div>,
    document.body
  )
}

export default auto(ShortcutBar)
