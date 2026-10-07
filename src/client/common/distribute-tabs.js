/**
 * Tab-to-pane distribution maths for the `autoDistributeTabsWhenLayoutChange`
 * setting.
 *
 * Scope is deliberately narrow: the setting only kicks in when leaving the
 * single layout for a layout with more panes. Once there is more than one pane
 * the arrangement is the user's own doing, so it is never reshuffled — the
 * store falls through to the pre-existing behaviour for every other transition.
 *
 * Pure on purpose (no store access) so the behaviour can be pinned down by unit
 * tests instead of by driving the app.
 */

/**
 * Evenly split tabs across `count` panes, preserving tab order. The leading
 * panes stay fuller when it does not divide evenly, so the first tabs stay in
 * the first pane.
 *
 *   6 -> 3 panes = 2/2/2      5 -> 3 panes = 2/2/1
 *   4 -> 3 panes = 2/1/1      7 -> 3 panes = 3/2/2
 *   6 -> 4 panes = 2/2/1/1    2 -> 3 panes = 1/1/0
 *
 * @param {number} total number of tabs
 * @param {number} count number of panes
 * @returns {number[]} the pane index for each tab, in tab order
 */
export function distributeTabsEvenly (total, count) {
  const panes = Math.max(1, Math.floor(Number(count)) || 1)
  const n = Math.max(0, Math.floor(Number(total)) || 0)
  const base = Math.floor(n / panes)
  const extra = n % panes
  const batches = []
  for (let pane = 0; pane < panes; pane++) {
    const size = base + (pane < extra ? 1 : 0)
    for (let i = 0; i < size; i++) {
      batches.push(pane)
    }
  }
  return batches
}

export default distributeTabsEvenly
