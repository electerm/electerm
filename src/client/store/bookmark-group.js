/**
 * bookmark group functions
 */

import _ from 'lodash'
import {
  defaultBookmarkGroupId,
  settingMap,
  sshConfigItems,
  terminalSshConfigType
} from '../common/constants'
import { insert, update } from '../common/db'

export default store => {
  Object.assign(store, {
    getBookmarkGroups () {
      return store.getItems('bookmarkGroups')
    },
    getBookmarkGroupsTotal () {
      return sshConfigItems.length
        ? [
          ...store.getBookmarkGroups(),
          {
            title: terminalSshConfigType,
            id: terminalSshConfigType,
            bookmarkIds: sshConfigItems.map(d => d.id)
          }
        ]
        : store.getBookmarkGroups()
    },
    setBookmarkGroups (items) {
      return store.setItems('bookmarkGroups', items)
    },

    async addBookmarkGroup (group) {
      store.bookmarkGroups.push(JSON.stringify(group))
      await insert(settingMap.bookmarkGroups, group)
      const _id = `${settingMap.bookmarkGroups}:order`
      await update(_id, store.getItems('bookmarkGroups').map(d => d.id)
      )
    },

    editBookmarkGroup (id, updates) {
      const items = store.getBookmarkGroups()
      const item = _.find(items, t => t.id === id)
      Object.assign(item, updates)
      store.setBookmarkGroups(items)
      update(id, updates, settingMap.bookmarkGroups, false)
    },

    openAllBookmarkInCategory (item) {
      let ids = item.bookmarkIds
      const gids = item.bookmarkGroupIds || []
      const bookmarkGroups = store.getBookmarkGroups()
      for (const gid of gids) {
        const g = _.find(bookmarkGroups, g => g.id === gid)
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
    },

    delBookmarkGroup ({ id }) {
      if (id === defaultBookmarkGroupId) {
        return
      }
      let bookmarkGroups = store.getBookmarkGroups()
      const tobeDel = _.find(bookmarkGroups, bg => bg.id === id)
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
        ? _.findIndex(
          bookmarkGroups,
          g => g.id === defaultBookmarkGroupId
        )
        : _.findIndex(
          bookmarkGroups,
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
  })
}
