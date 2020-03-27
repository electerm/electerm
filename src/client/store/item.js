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
      const items = store[type]
      items.unshift(item)
      if (type === settingMap.history && items.length > maxHistory) {
        store.removeOldHistoryFromDb(
          copy(items)
        )
        store[type] = items.slice(0, maxHistory)
      }
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
      const items = store[type]
      const item = _.find(items, t => t.id === id)
      if (!item) {
        return
      }
      // let index = _.findIndex(items, t => t.id === id)
      Object.assign(item, updates)
      if (dbNames.includes(type)) {
        update(id, updates, type, false)
      }
    },

    delItem ({ id }, type) {
      store[type] = store[type].filter(t => {
        return t.id !== id
      })
      if (dbNames.includes(type)) {
        remove(type, id)
      }
    },

    onDelItem (item, type) {
      if (item.id === store.settingItem.id) {
        store.settingItem = getInitItem(
          store[type],
          type
        )
      }
    }
  })
}
