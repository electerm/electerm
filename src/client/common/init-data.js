/**
 * Pure transforms for the batched startup DB read.
 *
 * No `window` / React here on purpose: unit-ci loads this module directly, and
 * the main process sends plain rows that still need the renderer-side password
 * decoding and display-order sorting.
 */

import { decObj } from './pass-enc.js'

/**
 * Turn raw db rows into store items, then apply the saved display order.
 * Same shape `find()` used to produce, including `_id` -> `id` and decObj.
 *
 * @param {Array} rows
 * @param {Array<string>} order saved id order, may be undefined
 * @returns {Array}
 */
export function toItems (rows, order) {
  const items = (rows || []).map(row => {
    const { _id, ...rest } = row
    return {
      id: _id,
      ...decObj(rest)
    }
  })
  if (order && order.length) {
    // index map instead of findIndex inside the comparator:
    // comparator sort is O(n²) with findIndex, O(n log n) with a map
    const orderMap = new Map(order.map((id, i) => [id, i]))
    items.sort((a, b) =>
      (orderMap.get(a.id) ?? -1) -
      (orderMap.get(b.id) ?? -1)
    )
  }
  return items
}

/**
 * Build the fields initData assigns to the store.
 *
 * Returns null when the payload is missing or incomplete, so the caller can
 * fall back to per-table reads instead of assigning a half-empty store (a
 * stale main-process bundle answers an unknown IPC name with `undefined`).
 *
 * @param {Object} payload result of the main process `loadInitData`
 * @param {Array<string>} names tables the renderer expects
 * @returns {Object|null}
 */
export function buildInitData (payload, names) {
  const tables = payload && payload.tables
  if (!tables) {
    return null
  }
  const ext = {}
  for (const name of names) {
    const table = tables[name]
    if (!table || !Array.isArray(table.rows)) {
      return null
    }
    ext[name] = toItems(table.rows, table.order)
  }
  ext.lastDataUpdateTime = payload.lastDataUpdateTime || 0
  return ext
}
