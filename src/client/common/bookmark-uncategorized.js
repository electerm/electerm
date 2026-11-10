/**
 * Collect category-less bookmarks on import
 *
 * The sidebar tree is built from the category references, so a bookmark that no
 * category points at is never rendered: not deleted, but unreachable — the user
 * can only find it by searching. Every import path therefore sweeps those
 * orphans into one fresh category named `uncategory-bookmarks-<stamp>`, instead
 * of leaving them out of view or folding them into `default`, where they would
 * be indistinguishable from the user's own bookmarks.
 *
 * Both the bookmarks-only import (components/tree-list/bookmark-upload.js) and
 * the full data import (store/sync.js importAll) call this, so the two paths
 * cannot drift apart.
 */

import dayjs from 'dayjs'
// explicit extension so the module also loads under node in unit tests; the
// common/ modules covered by src/test/unit-ci all do this
import uid from './uid.js'

export const uncategorizedBookmarkGroupPrefix = 'uncategory-bookmarks-'

export function uncategorizedBookmarkStamp () {
  return dayjs().format('YYYY-MM-DD-HH-mm-ss')
}

/**
 * Put every bookmark no category references into a new category.
 *
 * Mutates `bookmarkGroups` when there is something to collect, so a caller that
 * already holds the store arrays does not have to splice the result in. Returns
 * null (and leaves the groups untouched) when every bookmark is categorized.
 *
 * @param {Array} bookmarks bookmarks in the store, or about to be imported
 * @param {Array} bookmarkGroups categories in the store, or about to be imported
 * @param {Object} [options]
 * @param {string} [options.stamp] suffix of the new category title
 * @returns {Object|null} the created category, or null when nothing was stray
 */
export function collectUncategorizedBookmarks (
  bookmarks = [],
  bookmarkGroups = [],
  { stamp = uncategorizedBookmarkStamp() } = {}
) {
  const assigned = new Set()
  for (const group of bookmarkGroups) {
    for (const id of group.bookmarkIds || []) {
      assigned.add(id)
    }
  }
  const orphanIds = []
  for (const bookmark of bookmarks) {
    const id = bookmark && bookmark.id
    // the same id twice in the store is already a bug, but it must not turn
    // into the same id twice in the new category
    if (!id || assigned.has(id)) {
      continue
    }
    assigned.add(id)
    orphanIds.push(id)
  }
  if (!orphanIds.length) {
    return null
  }
  const group = {
    id: uid(),
    title: uncategorizedBookmarkGroupPrefix + stamp,
    color: '#0088cc',
    bookmarkIds: orphanIds,
    bookmarkGroupIds: []
  }
  bookmarkGroups.push(group)
  return group
}
