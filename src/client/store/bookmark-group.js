/**
 * bookmark group functions
 */

import _ from 'lodash'
import {
  defaultBookmarkGroupId,
  settingMap
} from '../common/constants'
import { insert, update } from '../common/db'

const { bookmarkGroups } = settingMap

export default store => {
  Object.assign(store, {
    async addBookmarkGroup (group) {
      store.bookmarkGroups.push(group)
      await insert(bookmarkGroups, group)
      const _id = `${bookmarkGroups}:order`
      await update(_id, store.bookmarkGroups.map(d => d.id)
      )
    },

    editBookmarkGroup (id, updates) {
      const items = store.bookmarkGroups
      const item = _.find(items, t => t.id === id)
      Object.assign(item, updates)
      update(id, updates, bookmarkGroups, false)
    },

    openAllBookmarkInCategory (item) {
      let ids = item.bookmarkIds
      const gids = item.bookmarkGroupIds || []
      const { bookmarkGroups } = store
      for (const gid of gids) {
        const g = _.find(bookmarkGroups, g => g.id === gid)
        if (g && g.bookmarkIds && g.bookmarkIds.length) {
          ids = [
            ...ids,
            ...g.bookmarkIds
          ]
        }
      }
      const { bookmarks } = store
      for (const id of ids) {
        const item = _.find(bookmarks, b => b.id === id)
        if (item) {
          store.addTab(item)
        }
      }
    },

    delBookmarkGroup ({ id }) {
      if (id === defaultBookmarkGroupId) {
        return
      }
      let { bookmarkGroups } = store
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
      store.bookmarkGroups = bookmarkGroups
      if (id === store.currentBookmarkGroupId) {
        store.currentBookmarkGroupId = ''
      }
    }
  })
}
