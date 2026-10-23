/**
 * What a right click (and, on touch screens, a long press) on the terminal
 * does. One setting for both inputs: they are the same gesture on a device
 * that has no right button.
 *
 *  - `context`: open the terminal context menu (default)
 *  - `paste`: paste the clipboard, no menu
 *  - `passthrough`: do nothing at all — no menu, no paste, and no
 *    `preventDefault()`, so the event reaches xterm (which may report it to
 *    the running program when mouse reporting is on) and the OS
 */

export const rightClickBehaviors = {
  context: 'context',
  paste: 'paste',
  passthrough: 'passthrough'
}

export const rightClickBehaviorList = Object.values(rightClickBehaviors)

/**
 * The old boolean `pasteWhenContextMenu` expressed the same choice (true =
 * paste, false = menu), and a config synced from a device running an older
 * version can still carry it, so it stays readable as a fallback. Older
 * configs are migrated on load (see src/app/lib/get-config.js), so this only
 * matters until the next save.
 */
export function getRightClickBehavior (config) {
  const behavior = config && config.rightClickBehavior
  if (rightClickBehaviorList.includes(behavior)) {
    return behavior
  }
  if (config && config.pasteWhenContextMenu) {
    return rightClickBehaviors.paste
  }
  return rightClickBehaviors.context
}

export function shouldOpenContextMenu (config) {
  return getRightClickBehavior(config) === rightClickBehaviors.context
}
