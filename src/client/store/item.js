/**
 * common db op
 */

import _ from 'lodash'
import {
  maxHistory,
  settingMap
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import { update, remove, dbNames } from '../common/db'
import copy from 'json-deep-copy'

export default store => {
  Object.assign(store, {
    removeOldHistoryFromDb (items) {
      const arr = items.slice(maxHistory).map(k => {
        return {
          db: 'history',
          id: k.id
        }
      })
      store.batchDbDel(arr)
    },

    addItem (item, type) {
      const items = store.getItems(type)
      items.unshift(item)
      if (type === settingMap.history && items.length > maxHistory) {
        store.removeOldHistoryFromDb(
          copy(items)
        )
        items.slice(0, maxHistory)
      }
      store.setItems(type, items)
      if (dbNames.includes(type)) {
        store.batchDbAdd([
          {
            db: type,
            obj: item
          }
        ])
      }
    },

    editItem (id, updates, type) {
      const items = store.getItems(type)
      const item = _.find(items, t => t.id === id)
      if (!item) {
        return
      }
      // let index = _.findIndex(items, t => t.id === id)
      Object.assign(item, updates)
      store.setItems(type, items)
      if (dbNames.includes(type)) {
        update(id, updates, type, false)
      }
    },

    delItem ({ id }, type) {
      const items = store.getItems(type).filter(t => {
        return t.id !== id
      })
      store.setItems(type, items)
      if (dbNames.includes(type)) {
        remove(type, id)
      }
    },

    onDelItem (item, type) {
      if (item.id === store.settingItem.id) {
        store.settingItem = getInitItem(
          store.getItems(type),
          type
        )
      }
    },

    getItems (type) {
      if (!store.shouldParse(type)) {
        return copy(store[type])
      }
      return copy(store[type]).map(d => {
        return JSON.parse(d)
      })
    },

    shouldParse (type) {
      return [
        'bookmarks',
        'bookmarkGroups',
        'tabs',
        'fileTransfers'
      ].includes(type)
    },

    setItems (type, items) {
      if (!store.shouldParse(type)) {
        store[type] = items
        return store
      }
      store[type] = items.map(d => {
        return JSON.stringify(d)
      })
    }

  })
}
