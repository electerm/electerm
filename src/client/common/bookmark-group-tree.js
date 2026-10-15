/**
 * bookmark group tree layout
 *
 * A group is a root when no other group references it from `bookmarkGroupIds`.
 * That is the only reliable signal: `level` is optional — groups imported from
 * other clients often carry no `level` at all — and it goes stale as soon as a
 * group is dragged in or out of a parent. Deriving roots from the parent
 * references keeps the sidebar tree and every group picker agreeing on the same
 * shape, so a nested group can never be rendered both as a root and as a child.
 */

import buildMap from './build-map.js'

// is `group` part of a cycle (a group reachable from itself by following child
// references)? Used only to pick where to break a cycle that has no root.
function isOnCycle (group, byId) {
  const seen = new Set()
  const stack = [...(group.bookmarkGroupIds || [])]
  while (stack.length) {
    const id = stack.pop()
    if (id === group.id) {
      return true
    }
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    stack.push(...(byId.get(id)?.bookmarkGroupIds || []))
  }
  return false
}

/**
 * Root groups, in the order the user arranged them.
 *
 * Groups no root can reach — a stray group whose parent is gone, or a cycle
 * between groups — are promoted to roots rather than dropped, so nothing
 * silently disappears from the UI. The outermost member of each such cluster is
 * the one promoted, which keeps the rest of the cluster nested under it instead
 * of flattening it.
 *
 * `alwaysRootIds` names groups that stay at the top level even when something
 * references them (the `default` group).
 */
export function getRootBookmarkGroups (bookmarkGroups = [], alwaysRootIds = []) {
  const always = new Set(alwaysRootIds)
  const byId = buildMap(bookmarkGroups)
  const childIds = new Set()
  for (const group of bookmarkGroups) {
    for (const id of group.bookmarkGroupIds || []) {
      childIds.add(id)
    }
  }

  const roots = bookmarkGroups.filter(group =>
    always.has(group.id) || !childIds.has(group.id)
  )

  const reachable = new Set()
  const markReachable = group => {
    if (!group || reachable.has(group.id)) {
      return
    }
    reachable.add(group.id)
    for (const id of group.bookmarkGroupIds || []) {
      markReachable(byId.get(id))
    }
  }
  for (const group of roots) {
    markReachable(group)
  }

  let pending = bookmarkGroups.filter(group => !reachable.has(group.id))
  while (pending.length) {
    const pendingIds = new Set(pending.map(group => group.id))
    const inner = new Set()
    for (const group of pending) {
      for (const id of group.bookmarkGroupIds || []) {
        if (pendingIds.has(id)) {
          inner.add(id)
        }
      }
    }
    const outermost = pending.filter(group => !inner.has(group.id))
    // nothing outermost means every remaining group sits in a cycle: break it
    const promote = outermost.length
      ? outermost
      : [pending.find(group => isOnCycle(group, byId)) || pending[0]]
    for (const group of promote) {
      roots.push(group)
      markReachable(group)
    }
    pending = bookmarkGroups.filter(group => !reachable.has(group.id))
  }

  return roots
}

/**
 * Walk the group tree, building each consumer's own node shape.
 *
 * `mapGroup(group, childNodes)` runs after the children are built, so a consumer
 * can drop a group based on what it ended up containing (search filtering, or
 * "only categories that hold bookmarks"). `mapBookmark(id)` is optional and lets
 * a picker interleave bookmark leaves with child groups.
 *
 * Every group is placed exactly once, so the nodes are safe to use as React and
 * antd keys.
 */
export function mapBookmarkGroupTree (
  bookmarkGroups = [],
  { mapGroup, mapBookmark, alwaysRootIds = [] } = {}
) {
  const byId = buildMap(bookmarkGroups)
  const placed = new Set()
  const walk = group => {
    if (!group || placed.has(group.id)) {
      return null
    }
    placed.add(group.id)
    const children = [
      ...(group.bookmarkGroupIds || []).map(id => walk(byId.get(id))),
      ...(mapBookmark ? (group.bookmarkIds || []).map(mapBookmark) : [])
    ].filter(Boolean)
    return mapGroup(group, children) || null
  }
  return getRootBookmarkGroups(bookmarkGroups, alwaysRootIds)
    .map(walk)
    .filter(Boolean)
}

/**
 * The group that owns `groupId`, or undefined when it is a root. Replaces the
 * old "is this group a level 2?" checks, which misread level-less imports.
 */
export function findBookmarkGroupParent (bookmarkGroups = [], groupId) {
  return bookmarkGroups.find(group =>
    (group.bookmarkGroupIds || []).includes(groupId)
  )
}
