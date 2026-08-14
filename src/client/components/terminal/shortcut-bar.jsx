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
 *
 * Only loaded on touch devices — see shortcut-bar-entry.jsx.
 * Data + persistence live in shortcut-bar-defs.js.
 */

import { auto } from 'manate/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DownOutlined, EditOutlined } from '@ant-design/icons'
import { refs } from '../common/ref'
import { shortcutBarHeight } from '../../common/constants'
import ShortcutBarEdit from './shortcut-bar-edit'
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
    <div className='shortcut-bar' role='toolbar'>
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
