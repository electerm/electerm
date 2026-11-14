/**
 * bookmark bar model
 *
 * The bar is the bookmark tree laid out horizontally, chrome-style: a bookmark
 * becomes a button, a group becomes a folder with a dropdown.
 *
 * The level the bar shows is the interesting decision. The tree's roots are
 * usually one `default` group holding everything, so rendering the roots as
 * folders would hide the whole bar behind a single dropdown. The default group
 * is therefore expanded inline — its bookmarks become bar buttons and its child
 * groups become folders — which is what chrome does with its own "bookmarks
 * bar" folder. Every other root stays a folder.
 *
 * Pure and dependency-free on purpose (`unit-ci` loads it directly, and it must
 * not pull in `constants.js`, which imports image assets).
 */

import buildMap from '../../common/build-map.js'
import { getRootBookmarkGroups } from '../../common/bookmark-group-tree.js'

/**
 * @returns {Array<{key: string, type: 'bookmark'|'group', bookmark?: object, group?: object, children?: Array}>}
 *   one entry per bar item, in tree order. Group items carry their own
 *   `children` in the same shape, so a folder dropdown and the bar itself are
 *   built by the same renderer.
 */
export function buildBarItems ({
  bookmarkGroups = [],
  bookmarksMap = new Map(),
  defaultGroupId = 'default'
} = {}) {
  const byId = buildMap(bookmarkGroups)
  // a bookmark or group referenced twice — imported data does that — must be
  // placed once: the keys become React keys and antd menu keys, and a duplicate
  // key is a React warning plus a menu that opens the wrong item.
  const placed = new Set()

  const bookmarkItem = id => {
    const bookmark = bookmarksMap.get(id)
    if (!bookmark || placed.has('b:' + id)) {
      return null
    }
    placed.add('b:' + id)
    return {
      key: 'bookmark:' + id,
      type: 'bookmark',
      bookmark
    }
  }

  const groupItem = group => {
    if (!group || placed.has('g:' + group.id)) {
      return null
    }
    placed.add('g:' + group.id)
    // same order as the sidebar tree: child groups first, then bookmarks
    const children = [
      ...(group.bookmarkGroupIds || []).map(id => groupItem(byId.get(id))),
      ...(group.bookmarkIds || []).map(bookmarkItem)
    ].filter(Boolean)
    return {
      key: 'group:' + group.id,
      type: 'group',
      group,
      children
    }
  }

  const items = []
  for (const root of getRootBookmarkGroups(bookmarkGroups, [defaultGroupId])) {
    if (root.id === defaultGroupId) {
      // marked as placed so a cycle that points back at it cannot re-enter it
      placed.add('g:' + root.id)
      for (const id of root.bookmarkGroupIds || []) {
        items.push(groupItem(byId.get(id)))
      }
      for (const id of root.bookmarkIds || []) {
        items.push(bookmarkItem(id))
      }
    } else {
      items.push(groupItem(root))
    }
  }
  return items.filter(Boolean)
}
