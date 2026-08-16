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

function sendToTerminal (data) {
  const { store } = window
  const term = refs.get('term-' + store.activeTabId)
  if (term && typeof term.runQuickCommand === 'function') {
    const resolved = resolveCursorMode(data, term)
    term.runQuickCommand(resolved, true)
  }
}

// honor the active terminal's DECCKM state for the cursor / Home / End keys
function resolveCursorMode (data, term) {
  const app = appCursorMap[data]
  if (app && term?.term?.modes?.applicationCursorKeysMode) {
    return app
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
    document.documentElement.style.setProperty(
      '--shortcut-bar-kb-offset',
      kbOffset ? kbOffset + 'px' : '0px'
    )
    store.shortcutBarKbOffset = kbOffset
  }, [kbOffset])

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

  function renderButton (b, i) {
    return (
      <button
        type='button'
        key={b.id + '-' + i}
        className='shortcut-bar-btn'
        onClick={() => sendToTerminal(b.data)}
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
