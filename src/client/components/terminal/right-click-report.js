/**
 * Whether a right click on the terminal should be reported to the program.
 *
 * When the program inside the terminal asks for mouse reports (`vim` with
 * `set mouse=a`, `tmux` with `set -g mouse on`, `htop`), xterm.js stops
 * treating the pointer as a text pointer and encodes every click as a report
 * for that program - the right button included. electerm then opens its own
 * context menu on the very same click, so two consumers act on one gesture and
 * the program reacts to a click the user aimed at the menu.
 *
 * vim makes that visible: its `'mousemodel'` is `extend` by default, documented
 * as "the right mouse button extends a selection. This works like in an
 * xterm", so a forwarded right click drops it into visual mode and selects
 * whatever lies between the cursor and the pointer.
 *
 * The forwarded pair is also what breaks on Linux. There the menu is already up
 * when the release arrives, so the `mouseup` targets the dropdown (or the
 * helper textarea xterm moves under the cursor); xterm resolves the report
 * coordinates from the event target, gets nothing, and the release report is
 * never sent. The program is left believing the button is still held, and keeps
 * extending that selection while the pointer moves - which is what looks like
 * "right click selects a random string".
 *
 * Hence one click, one owner, mirroring `rightClickBehavior`:
 *  - `context` / `paste`: electerm acts on the click, nothing is reported
 *  - `passthrough`: the click belongs to the program, report it as before
 *
 * The guard is inert while no program is asking for the mouse: xterm sends
 * nothing in that state, so a plain shell behaves exactly as it always has.
 */
import {
  getRightClickBehavior,
  rightClickBehaviors
} from '../../common/right-click-behavior.js'

/**
 * Is the program in this terminal currently receiving mouse reports?
 * `mouseTrackingMode` stays 'none' until a program sends `ESC[?1000h` and
 * friends; it is a public xterm API, not a private field.
 *
 * @param {object} term - xterm instance
 * @returns {boolean}
 */
export function isMouseTrackingActive (term) {
  const mode = term && term.modes && term.modes.mouseTrackingMode
  return !!mode && mode !== 'none'
}

/**
 * @param {object} options
 * @param {object} options.config - electerm config
 *   (`rightClickBehavior`, `mouseEventsRequireAlt`)
 * @param {boolean} options.mouseTrackingActive - see isMouseTrackingActive
 * @param {boolean} [options.altKey] - was Alt held for this click
 * @returns {boolean} true = let the click reach xterm, which reports it
 */
export function shouldForwardRightClick ({
  config,
  mouseTrackingActive,
  altKey = false
} = {}) {
  if (!mouseTrackingActive) {
    return true
  }
  if (getRightClickBehavior(config) === rightClickBehaviors.passthrough) {
    return true
  }
  // `mouseEventsRequireAlt` already keeps every plain click local and hands the
  // pointer over only while Alt is held. Someone holding Alt is asking for the
  // report, so this must not take it away from them.
  if (config && config.mouseEventsRequireAlt) {
    return !!altKey
  }
  return false
}
