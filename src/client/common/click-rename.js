/**
 * "Click an already selected item again to rename it", the way the OS file
 * managers do it.
 *
 * Dependency-free on purpose: `npm run test-unit-ci` loads this file directly.
 *
 * The caller arms a timer for `clickRenameDelay` and only commits the rename
 * when that timer fires. A double click lands well inside that window, so it
 * cancels the timer and open / enter-directory still wins over rename.
 */

export const clickRenameDelay = 500

/**
 * Whether a click on this row should arm the rename timer.
 *
 * `selectedIds` is the selection as it was *before* the click: the first click
 * on a row selects it (no rename), a click on a row that is already the only
 * selected one is the "second click" the OS treats as rename.
 */
export function shouldArmClickRename ({
  file,
  selectedIds,
  modifierKey = false,
  isMobile = false
} = {}) {
  if (isMobile || modifierKey) {
    return false
  }
  if (!file || !file.id || file.isEmpty || file.isParent || file.isEditing) {
    return false
  }
  if (!selectedIds || typeof selectedIds.has !== 'function') {
    return false
  }
  return selectedIds.size === 1 && selectedIds.has(file.id)
}
