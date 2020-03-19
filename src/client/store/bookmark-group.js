/**
 * bookmark group functions
 */

import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  defaultBookmarkGroupId,
  terminalSshConfigType
} from '../common/constants'
import { dbAction, setData } from '../common/db'

const { getGlobal } = window
const sshConfigItems = copy(getGlobal('sshConfigItems'))

export default store => {
  Object.assign(store, {
    get bookmarkGroupsTotal () {
      return store.sshConfigItems.length
        ? [
          ...store.bookmarkGroups,
          {
            title: terminalSshConfigType,
            id: terminalSshConfigType,
            bookmarkIds: sshConfigItems.map(d => d.id)
          }
        ]
        : store.bookmarkGroups
    },

    addBookmarkGroup (group) {
      store.bookmarkGroups.push(group)
      const {
        id, ...rest
      } = group
      dbAction('bookmarkGroups', 'insert', {
        _id: id,
        ...rest
      })
      const q = {
        _id: 'bookmarkGroups:order'
      }
      setData('data', 'update', q, {
        ...q,
        value: store.bookmarkGroups.map(d => d.id)
      }, {
        upsert: true
      })
    },

    editBookmarkGroup (id, update) {
      const items = store.bookmarkGroups
      const item = _.find(items, t => t.id === id)
      Object.assign(item, update)
      dbAction('bookmarkGroups', 'update', {
        _id: id
      }, update)
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
        }
      }
      bookmarkGroups = bookmarkGroups.filter(t => {
        return !groupIds.includes(t.id)
      })
      store.bookmarkGroups = bookmarkGroups
      if (id === store.currentBookmarkGroupId) {
        store.currentBookmarkGroupId = ''
      }
    }
  })
}
