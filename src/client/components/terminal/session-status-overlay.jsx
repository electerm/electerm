import { memo } from 'react'
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
 */
export default memo(function SessionStatusOverlay ({
  stopped,
  countdown,
  reloadShortcut,
  closeShortcut,
  onReload,
  onClose
}) {
  const reconnecting = countdown !== null && countdown !== undefined
  if (!reconnecting && !stopped) {
    return null
  }
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
            title={`${e('reload')} (${reloadShortcut})`}
            onClick={stop(onReload)}
          >
            {e('reload')}
            <span className='mg1l'>{reloadShortcut}</span>
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
