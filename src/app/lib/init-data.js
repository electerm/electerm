/**
 * Batched startup DB read for the renderer.
 *
 * `store.initData` used to issue two runGlobalAsync calls per table (a `find`
 * on the table plus a `findOne` on `data` for the saved `:order`) and one more
 * for `lastDataUpdateTime`. Each one is a full renderer -> main -> renderer
 * round trip with its own structured clone. This walks the same tables in the
 * main process and sends one payload back.
 *
 * Kept dependency free (dbAction is injected) so it stays off the pre-window
 * startup path and can be tested in plain node.
 *
 * dbAction is `async` but fully synchronous inside: sqlite/nedb decrypt every
 * row and JSON.parse it inline, and rows in bookmark-like tables are encrypted
 * at rest (one OS safeStorage call each). A Promise.all over all tables runs
 * them back to back in a *single* macrotask, so ~1200 encrypted bookmarks hold
 * the main process for ~100 ms and starve the renderer's startup `init` IPC
 * and common websocket handshake. Reading tables one at a time with a
 * setImmediate gap before each lets those interleave. Measured on a cold
 * start: without the gaps initApp takes 135 ms instead of 91 ms and the
 * batched read loses to the original per-table path; with them it wins on
 * both small and large databases.
 */

/**
 * @param {Function} dbAction main process db dispatcher
 * @param {Array<string>} tables known table names, used as an allowlist
 * @returns {(names: Array<string>) => Promise<Object>}
 */
function createLoadInitData (dbAction, tables) {
  const known = new Set(tables)
  return async function loadInitData (names) {
    const list = Array.isArray(names) ? names.filter(n => known.has(n)) : []
    const result = {}
    for (const name of list) {
      await new Promise(resolve => setImmediate(resolve))
      const rows = await dbAction(name, 'find', {})
      const order = await dbAction('data', 'findOne', {
        _id: `${name}:order`
      })
      result[name] = {
        rows: rows || [],
        order: order ? order.value : undefined
      }
    }
    const last = await dbAction('data', 'findOne', {
      _id: 'lastDataUpdateTime'
    })
    return {
      tables: result,
      lastDataUpdateTime: last ? last.value : undefined
    }
  }
}

module.exports = {
  createLoadInitData
}
