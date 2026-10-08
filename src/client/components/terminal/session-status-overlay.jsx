import { memo } from 'react'

const e = window.translate

/**
 * Shown over a dead terminal pane. Deliberately a DOM overlay and not
 * `term.write()`: anything written into the buffer is captured by
 * `socketMixin.getReloadState()` (serializeAddon + alternate-buffer snapshot)
 * and replayed into the *next* session after a restart, and it would also land
 * in the terminal log file and in copy selections.
 *
 * It only *names* shortcuts that already act on a dead session - reload (which
 * restarts it) and close - so there is nothing new to learn, no key handling
 * here, and no new locale strings. Both states share the component, so a user
 * with auto reconnect on never sees a countdown and a notice at the same time.
 */
export default memo(function SessionStatusOverlay ({
  stopped,
  countdown,
  reloadShortcut,
  closeShortcut
}) {
  const reconnecting = countdown !== null && countdown !== undefined
  if (!reconnecting && !stopped) {
    return null
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
      <div className='pd1'>
        {e('reload')}: {reloadShortcut}
      </div>
      <div className='pd1'>
        {e('close')}: {closeShortcut}
      </div>
    </div>
  )
})
