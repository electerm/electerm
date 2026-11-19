/**
 * Resolve the bookmark a tab (or a connection error) was opened from.
 *
 * Tabs opened from a bookmark carry `from: 'bookmarks'` and `srcId`.
 * Quick connect / history / MCP / widget tabs have no source bookmark,
 * so there is nothing to edit for them.
 *
 * Dependency-free on purpose: `npm run test-unit-ci` loads this file directly.
 */
export default function getSourceBookmark (item, store) {
  if (!item || item.from !== 'bookmarks' || !item.srcId) {
    return undefined
  }
  const { bookmarksMap, bookmarks } = store || {}
  return bookmarksMap?.get(item.srcId) ||
    bookmarks?.find(d => d.id === item.srcId)
}
