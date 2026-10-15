import createName from '../../common/create-title'
import { defaultBookmarkGroupId } from '../../common/constants'

function bookmarkCompare (a, b, bookmarksMap, sortTitle, sortHost) {
  const itemA = bookmarksMap.get(a)
  const itemB = bookmarksMap.get(b)
  if (!itemA || !itemB) {
    return 0
  }

  if (sortTitle) {
    const cmp = (itemA.title || '').localeCompare(itemB.title || '')
    if (cmp !== 0) {
      return sortTitle === 'asc' ? cmp : -cmp
    }
  }

  if (sortHost) {
    const cmp = (itemA.host || '').localeCompare(itemB.host || '')
    if (cmp !== 0) {
      return sortHost === 'asc' ? cmp : -cmp
    }
  }

  return 0
}

export function buildVisibleTreeRows ({
  bookmarkGroups,
  bookmarkGroupTree,
  bookmarksMap,
  expandedKeys,
  keyword,
  sortTitle,
  sortHost
}) {
  const groupTree = bookmarkGroupTree || new Map()
  const getGroup = id => groupTree instanceof Map
    ? groupTree.get(id)
    : groupTree[id]
  const rows = []
  const matchedRowKeys = []
  const groups = bookmarkGroups || []
  const nestedGroupIds = new Set()
  const visitedGroupIds = new Set()
  const visitedBookmarkIds = new Set()
  const expandedKeySet = new Set(expandedKeys || [])
  const lowerKeyword = (keyword || '').toLowerCase()
  const bookmarkMatchCache = new Map()
  const groupMatchCache = new Map()
  const groupMatchInProgress = new Set()

  for (const group of groups) {
    for (const groupId of group?.bookmarkGroupIds || []) {
      nestedGroupIds.add(groupId)
    }
  }

  const rootGroups = groups.filter(group => {
    return group?.id === defaultBookmarkGroupId || !nestedGroupIds.has(group?.id)
  })

  // Preserve disconnected groups too, including malformed cycles with no root.
  const reachableGroupIds = new Set()
  const markGroupReachable = group => {
    if (!group || reachableGroupIds.has(group.id)) {
      return
    }
    reachableGroupIds.add(group.id)
    for (const groupId of group.bookmarkGroupIds || []) {
      markGroupReachable(getGroup(groupId))
    }
  }
  for (const group of rootGroups) {
    markGroupReachable(group)
  }
  for (const group of groups) {
    if (reachableGroupIds.has(group.id)) {
      continue
    }
    rootGroups.push(group)
    markGroupReachable(group)
  }

  const bookmarkMatches = (bookmarkId) => {
    if (bookmarkMatchCache.has(bookmarkId)) {
      return bookmarkMatchCache.get(bookmarkId)
    }
    const item = bookmarksMap.get(bookmarkId)
    const matched = Boolean(
      item &&
      (!lowerKeyword ||
        createName(item).toLowerCase().includes(lowerKeyword) ||
        (item.description || '').toLowerCase().includes(lowerKeyword))
    )
    bookmarkMatchCache.set(bookmarkId, matched)
    return matched
  }

  const groupHasMatchedBookmarks = (group) => {
    if (!lowerKeyword) {
      return true
    }
    if (!group) {
      return false
    }
    if (groupMatchCache.has(group.id)) {
      return groupMatchCache.get(group.id)
    }
    if (groupMatchInProgress.has(group.id)) {
      return false
    }
    groupMatchInProgress.add(group.id)
    const hasMatch = (group.bookmarkIds || []).some(bookmarkMatches) ||
      (group.bookmarkGroupIds || []).some(id => {
        return groupHasMatchedBookmarks(getGroup(id))
      })
    groupMatchInProgress.delete(group.id)
    groupMatchCache.set(group.id, hasMatch)
    return hasMatch
  }

  const visitGroup = (group, parentId = '', depth = 1) => {
    if (
      !group ||
      visitedGroupIds.has(group.id) ||
      (lowerKeyword && !groupHasMatchedBookmarks(group))
    ) {
      return
    }
    visitedGroupIds.add(group.id)

    rows.push({
      key: `group:${group.id}`,
      item: group,
      isGroup: true,
      parentId,
      depth
    })

    if (!lowerKeyword && !expandedKeySet.has(group.id)) {
      return
    }

    const nextParentId = parentId
      ? `${parentId}#${group.id}`
      : `#${group.id}`

    for (const groupId of group.bookmarkGroupIds || []) {
      visitGroup(getGroup(groupId), nextParentId, depth + 1)
    }

    const bookmarkIds = group.bookmarkIds || []
    const sortedIds = (sortTitle || sortHost)
      ? [...bookmarkIds].sort((a, b) => bookmarkCompare(a, b, bookmarksMap, sortTitle, sortHost))
      : bookmarkIds

    for (const bookmarkId of sortedIds) {
      if (visitedBookmarkIds.has(bookmarkId)) {
        continue
      }
      const item = bookmarksMap.get(bookmarkId)
      if (!item || (lowerKeyword && !bookmarkMatches(bookmarkId))) {
        continue
      }
      visitedBookmarkIds.add(bookmarkId)
      const rowKey = `bookmark:${item.id}`
      rows.push({
        key: rowKey,
        item,
        isGroup: false,
        parentId: nextParentId,
        depth
      })
      if (lowerKeyword) {
        matchedRowKeys.push(rowKey)
      }
    }
  }

  for (const group of rootGroups) {
    visitGroup(group)
  }

  return {
    rows,
    matchedRowKeys
  }
}
