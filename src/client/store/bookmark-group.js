/**
 * bookmark group functions
 */

import { find } from 'lodash-es'
import {
  defaultBookmarkGroupId,
  settingMap,
  terminalSshConfigType
} from '../common/constants'

export default Store => {
  Store.prototype.getBookmarkGroupsTotal = function () {
    const { store } = window
    return store.sshConfigItems.length && !store.config.hideSshConfig
      ? [
          ...store.bookmarkGroups,
          {
            title: terminalSshConfigType,
            id: terminalSshConfigType,
            bookmarkIds: store.sshConfigItems.map(d => d.id)
          }
        ]
      : store.bookmarkGroups
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

  Store.prototype.delBookmarkGroup = function ({ id }) {
    const { store } = window
    if (id === defaultBookmarkGroupId) {
      return
    }
    let bookmarkGroups = store.bookmarkGroups
    const tobeDel = find(bookmarkGroups, bg => bg.id === id)
    if (!tobeDel) {
      return
    }
    let groups = [tobeDel]
    if (
      tobeDel.level !== 2 &&
      tobeDel.bookmarkGroupIds &&
      tobeDel.bookmarkGroupIds.length > 0
    ) {
      const childs = bookmarkGroups.filter(
        bg => tobeDel.bookmarkGroupIds.includes(bg.id)
      )
      groups = [
        ...groups,
        ...childs
      ]
    }
    const groupIds = groups.map(g => g.id)
    const updates = []
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
        def.bookmarkIds = [
          ...g.bookmarkIds,
          ...def.bookmarkIds
        ]
        updates.push({
          id: def.id,
          db: 'bookmarkGroups',
          upsert: false,
          update: {
            bookmarkIds: def.bookmarkIds
          }
        })
      }
    }
    bookmarkGroups = bookmarkGroups.filter(t => {
      return !groupIds.includes(t.id)
    })
    store.batchDbUpdate(updates)
    store.batchDbDel(groupIds.map(id => {
      return {
        id,
        db: 'bookmarkGroups'
      }
    }))
    store.setBookmarkGroups(bookmarkGroups)
    if (id === store.currentBookmarkGroupId) {
      store.currentBookmarkGroupId = ''
    }
  }
}
