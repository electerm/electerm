import { memo, useEffect } from 'react'
import { Button } from 'antd'
import {
  ReloadOutlined,
  CloseOutlined
} from '@ant-design/icons'

const e = window.translate

/**
 * Shown over a dead terminal pane. Deliberately a DOM overlay and not
 * `term.write()`: anything written into the buffer is captured by
 * `socketMixin.getReloadState()` (serializeAddon + alternate-buffer snapshot)
 * and replayed into the *next* session after a restart, and it would also land
 * in the terminal log file and in copy selections.
 *
 * It only offers actions that already act on a dead session - reload (which
 * restarts it) and close - and prints each one's shortcut next to the button,
 * so the keyboard path stays discoverable without anything new to learn and
 * without new locale strings. Both states share the component, so a user with
 * auto reconnect on never sees a countdown and a notice at the same time.
 *
 * `stopped` covers a session that never came up as well as one that died, so a
 * failed connection gets the same two ways out. `terminal-error-handle.jsx`
 * renders alongside it in that case and keeps the message: this box is centred
 * and that alert is pinned to the top of the pane, so neither hides the other.
 */
export default memo(function SessionStatusOverlay ({
  active,
  terminalInput,
  stopped,
  countdown,
  reloadShortcut,
  closeShortcut,
  onReload,
  onClose
}) {
  const reconnecting = countdown !== null && countdown !== undefined
  const visible = stopped || reconnecting
  useEffect(() => {
    if (!active || !visible) return

    // A failed start can leave focus on body. After a disconnect, it can
    // still be on this pane's xterm textarea, which handles keys at target.
    const onKeyDown = event => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          (event.target !== document.body && event.target !== terminalInput)) return
      const dialogs = document.querySelectorAll('.custom-modal-wrap, [aria-modal="true"]')
      if (Array.from(dialogs).some(dialog => dialog.getClientRects().length)) return

      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) onReload()
    }
    document.body.addEventListener('keydown', onKeyDown, true)
    return () => document.body.removeEventListener('keydown', onKeyDown, true)
  }, [active, visible, terminalInput, onReload])
  if (!visible) return null

  const reloadKeys = [reloadShortcut, 'Enter'].filter(Boolean).join(' / ')
  // The click must not reach `session.jsx`'s handleClick, which does
  // `store.activeTabId = this.props.tab.id`. It fires after this handler, so it
  // would point activeTabId back at the tab we are in the middle of replacing
  // (reload) or removing (close) - leaving it naming a tab that no longer
  // exists. The keyboard shortcuts never had this problem: no click, no bubble.
  const stop = fn => event => {
    event.stopPropagation()
    fn()
  }
  return (
    <div className='terminal-session-stopped pd1'>
      {
        reconnecting && (
          <div className='pd1'>
            {e('autoReconnectTerminal')}: {countdown}s
          </div>
        )
      }
      <div className='terminal-session-actions pd1y'>
        <p>
          <Button
            type='default'
            icon={<ReloadOutlined />}
            title={`${e('reload')} (${reloadKeys})`}
            onClick={stop(onReload)}
          >
            {e('reload')}
            <span className='mg1l'>{reloadKeys}</span>
          </Button>
        </p>
        <p>
          <Button
            type='default'
            icon={<CloseOutlined />}
            title={`${e('close')} (${closeShortcut})`}
            onClick={stop(onClose)}
          >
            {e('close')}
            <span className='mg1l'>{closeShortcut}</span>
          </Button>
        </p>
      </div>
    </div>
  )
})
