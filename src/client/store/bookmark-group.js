/**
 * bookmark group functions
 */

import { find } from 'lodash-es'
import {
  defaultBookmarkGroupId,
  settingMap
} from '../common/constants'
import { action } from 'manate'

export default Store => {
  Store.prototype.getBookmarkGroupsTotal = function () {
    return window.store.bookmarkGroups
  }

  Store.prototype.setBookmarkGroups = function (items) {
    return window.store.setItems('bookmarkGroups', items)
  }

  Store.prototype.addBookmarkGroup = async function (group) {
    window.store.addItem(group, settingMap.bookmarkGroups)
  }

  Store.prototype.editBookmarkGroup = function (id, updates) {
    window.store.editItem(id, updates, settingMap.bookmarkGroups)
  }

  Store.prototype.openAllBookmarkInCategory = function (item) {
    const { store } = window
    let ids = item.bookmarkIds
    const gids = item.bookmarkGroupIds || []
    const bookmarkGroups = store.bookmarkGroups
    for (const gid of gids) {
      const g = find(bookmarkGroups, g => g.id === gid)
      if (g && g.bookmarkIds && g.bookmarkIds.length) {
        ids = [
          ...ids,
          ...g.bookmarkIds
        ]
      }
    }
    for (const id of ids) {
      store.onSelectBookmark(id)
    }
  }

  Store.prototype.delBookmarkGroup = action(function ({ id }) {
    const { store } = window
    if (id === defaultBookmarkGroupId) {
      return
    }
    let { bookmarkGroups } = store
    const tobeDel = find(bookmarkGroups, bg => bg.id === id)
    if (!tobeDel) {
      return
    }
    const groups = [tobeDel]
    if (
      tobeDel.level !== 2 &&
      tobeDel.bookmarkGroupIds &&
      tobeDel.bookmarkGroupIds.length > 0
    ) {
      const childs = bookmarkGroups.filter(
        bg => tobeDel.bookmarkGroupIds.includes(bg.id)
      )
      groups.push(...childs)
    }
    const groupIds = groups.map(g => g.id)
    const defaultCatIndex = tobeDel.level !== 2
      ? bookmarkGroups.findIndex(
        g => g.id === defaultBookmarkGroupId
      )
      : bookmarkGroups.findIndex(
        g => (g.bookmarkGroupIds || []).includes(tobeDel.id)
      )
    for (const g of groups) {
      if (g.bookmarkIds.length) {
        const def = bookmarkGroups[defaultCatIndex]
        def.bookmarkIds.push(...g.bookmarkIds)
      }
    }
    bookmarkGroups = bookmarkGroups.filter(t => {
      return !groupIds.includes(t.id)
    })
    if (id === store.currentBookmarkGroupId) {
      store.currentBookmarkGroupId = ''
    }
  })

  Store.prototype.fixBookmarkGroups = function () {
    const { store } = window
    const { bookmarks, bookmarkGroups } = store

    // Create sets for quick lookup
    const bookmarkIds = new Set(bookmarks.map(b => b.id))
    const groupIds = new Set(bookmarkGroups.map(g => g.id))

    // Fix bookmarkGroups
    for (const group of bookmarkGroups) {
      // Fix bookmarkIds - remove non-existent bookmark references
      if (group.bookmarkIds) {
        group.bookmarkIds = group.bookmarkIds.filter(id => bookmarkIds.has(id))
      } else {
        group.bookmarkIds = []
      }

      // Fix bookmarkGroupIds - remove non-existent group references
      if (group.bookmarkGroupIds) {
        group.bookmarkGroupIds = group.bookmarkGroupIds.filter(id =>
          groupIds.has(id) && id !== group.id // Prevent self-reference
        )
      } else {
        group.bookmarkGroupIds = []
      }
    }

    // Find stray bookmarks (not belonging to any group)
    const assignedBookmarkIds = new Set(
      bookmarkGroups.reduce((acc, group) =>
        [...acc, ...(group.bookmarkIds || [])],
      [])
    )
    const defaultGroup = bookmarkGroups.find(g => g.id === defaultBookmarkGroupId)
    const strayBookmarkIds = bookmarks
      .map(b => b.id)
      .filter(id => !assignedBookmarkIds.has(id))

    // Add stray bookmarks to default group
    if (strayBookmarkIds.length) {
      if (defaultGroup) {
        defaultGroup.bookmarkIds = [
          ...new Set([...defaultGroup.bookmarkIds, ...strayBookmarkIds])
        ]
      }
    }

    // Find stray groups (not belonging to any parent group and not being a top-level group)
    const assignedGroupIds = new Set(
      bookmarkGroups.reduce((acc, group) =>
        [...acc, ...(group.bookmarkGroupIds || [])],
      [])
    )

    const strayGroups = bookmarkGroups.filter(group =>
      group.level === 2 && // Only check non-top-level groups
      group.id !== defaultBookmarkGroupId && // Exclude default group
      !assignedGroupIds.has(group.id) // Not assigned to any parent
    )

    // Find a suitable parent for stray groups
    if (strayGroups.length) {
      defaultGroup.bookmarkGroupIds = [
        ...new Set([...defaultGroup.bookmarkGroupIds, ...strayGroups.map(g => g.id)])
      ]
    }
  }
}
