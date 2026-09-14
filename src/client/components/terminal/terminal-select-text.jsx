/**
 * Full-screen plain-text view of the buffer, for touch devices.
 *
 * Selecting inside a canvas-rendered terminal on a phone is hopeless: there is
 * no system selection to lean on, so every touch terminal ends up
 * re-implementing magnifiers, draggable handles and edge auto-scroll. This
 * takes the other route — hand the text to an ordinary read-only <textarea>
 * and let iOS/Android supply the whole native toolbox (long-press word select,
 * resizable handles, the Copy callout) for free.
 *
 * Rendered through a portal onto <body> rather than in place: `.term-wrap` is
 * a positioned element with its own z-index, so anything inside it is trapped
 * in that stacking context and would still be covered by the touch shortcut
 * bar (z-index 400). The portal also keeps these styles away from
 * `.term-wrap`, which switches off -webkit-touch-callout and user-select for
 * the terminal's own gestures — `-webkit-touch-callout` is inherited, so
 * without the reset in terminal.styl the native callout would never appear.
 *
 * React events still bubble along the React tree, not the DOM one, so the
 * parent's touch handlers and the antd Dropdown's `contextMenu` trigger both
 * still see events from here. Two guards in response:
 *  - term-touch.js bails out of any touch start whose target is this overlay;
 *  - the contextmenu handler below stops the event, which would otherwise open
 *    the terminal menu on top of the selection. Only propagation is stopped,
 *    never the default action, since that default action *is* the native
 *    callout being relied on.
 *
 * The content is a snapshot taken when the panel opens: output arriving
 * afterwards keeps going to the terminal underneath and cannot disturb a
 * selection the user is in the middle of making.
 */

import { memo } from 'react'
import { createPortal } from 'react-dom'

const e = window.translate

export default memo(function TerminalSelectText (props) {
  if (!props.visible) {
    return null
  }
  const blockMenu = ev => ev.stopPropagation()
  return createPortal(
    <div
      className='terminal-select-text'
      onContextMenu={blockMenu}
    >
      <div className='terminal-select-text-bar'>
        <span>{e('selectText')}</span>
        <span className='terminal-select-text-btns'>
          <a onClick={props.onSelectAll}>{e('selectall')}</a>
          <a onClick={props.onCopy}>{e('copy')}</a>
          <a onClick={props.onClose}>{e('close')}</a>
        </span>
      </div>
      <textarea
        className='terminal-select-text-area'
        ref={props.textareaRef}
        value={props.text}
        readOnly
        spellCheck={false}
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='off'
      />
    </div>,
    document.body
  )
})
