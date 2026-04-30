import createName from '../../common/create-title'

function isTopLevelGroup (group) {
  return !group?.level || group.level < 2
}

export function buildVisibleTreeRows ({
  bookmarkGroups,
  bookmarkGroupTree,
  bookmarksMap,
  expandedKeys,
  keyword
}) {
  const groupTree = bookmarkGroupTree || {}
  const rows = []
  const matchedRowKeys = []
  const expandedKeySet = new Set(expandedKeys || [])
  const lowerKeyword = (keyword || '').toLowerCase()
  const bookmarkMatchCache = new Map()
  const groupMatchCache = new Map()

  const bookmarkMatches = (bookmarkId) => {
    if (bookmarkMatchCache.has(bookmarkId)) {
      return bookmarkMatchCache.get(bookmarkId)
    }
    const item = bookmarksMap.get(bookmarkId)
    const matched = Boolean(
      item &&
      (!lowerKeyword || createName(item).toLowerCase().includes(lowerKeyword))
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
    const hasMatch = (group.bookmarkIds || []).some(bookmarkMatches) ||
      (group.bookmarkGroupIds || []).some(id => {
        return groupHasMatchedBookmarks(groupTree[id])
      })
    groupMatchCache.set(group.id, hasMatch)
    return hasMatch
  }

  const visitGroup = (group, parentId = '', depth = 1) => {
    if (!group || (lowerKeyword && !groupHasMatchedBookmarks(group))) {
      return
    }

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
      visitGroup(groupTree[groupId], nextParentId, depth + 1)
    }

    for (const bookmarkId of group.bookmarkIds || []) {
      const item = bookmarksMap.get(bookmarkId)
      if (!item || (lowerKeyword && !bookmarkMatches(bookmarkId))) {
        continue
      }
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

  for (const group of bookmarkGroups || []) {
    if (isTopLevelGroup(group)) {
      visitGroup(group)
    }
  }

  return {
    rows,
    matchedRowKeys
  }
}
