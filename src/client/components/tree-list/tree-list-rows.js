import createName from '../../common/create-title'

// the row identity the list navigates by, kept here so the keyboard cursor and
// the click handler below agree on it
export function getRowKey (id, isGroup) {
  return `${isGroup ? 'group' : 'bookmark'}:${id}`
}

function isTopLevelGroup (group) {
  return !group?.level || group.level < 2
}

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
    const hasMatch = (group.bookmarkIds || []).some(bookmarkMatches) ||
      (group.bookmarkGroupIds || []).some(id => {
        return groupHasMatchedBookmarks(getGroup(id))
      })
    groupMatchCache.set(group.id, hasMatch)
    return hasMatch
  }

  const visitGroup = (group, parentId = '', depth = 1) => {
    if (!group || (lowerKeyword && !groupHasMatchedBookmarks(group))) {
      return
    }

    rows.push({
      key: getRowKey(group.id, true),
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
      const item = bookmarksMap.get(bookmarkId)
      if (!item || (lowerKeyword && !bookmarkMatches(bookmarkId))) {
        continue
      }
      const key = getRowKey(item.id, false)
      rows.push({
        key,
        item,
        isGroup: false,
        parentId: nextParentId,
        depth
      })
      if (lowerKeyword) {
        matchedRowKeys.push(key)
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
