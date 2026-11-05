/**
 * Row identity for the tables the widget panel draws.
 *
 * antd calls `rowKey` on every render and has deprecated handing it the row
 * index: an index is a position, not an identity, so a row changes key as soon
 * as the data around it changes.
 *
 * The widget payload is arbitrary user data: a row usually has no id, and two
 * rows can be equal, so identity has to come from the object itself. A WeakMap
 * gives each row object one number the first time it is seen and keeps it for
 * as long as that result lives — stable across renders, cheap, and it leaves
 * the data untouched.
 *
 * Row content is deliberately not used as a key: a row can carry a password,
 * and a row key ends up in the DOM as `data-row-key`.
 */
const keys = new WeakMap()
let counter = 0

export function widgetRowKey (row) {
  if (!row || typeof row !== 'object') {
    return 'v' + String(row)
  }
  let key = keys.get(row)
  if (key === undefined) {
    counter += 1
    key = counter
    keys.set(row, key)
  }
  return 'r' + key
}
