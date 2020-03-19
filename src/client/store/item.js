/**
 * common db op
 */

import _ from 'lodash'
import {
  maxHistory,
  settingMap
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import { dbAction, dbNames } from '../common/db'
import copy from 'json-deep-copy'

export default store => {
  Object.assign(store, {
    removeOldHistoryFromDb (items) {
      const arr = items.splice(maxHistory).map(k => {
        return {
          db: 'history',
          obj: k
        }
      })
      store.batchDbDel(arr)
    },

    addItem (item, type) {
      let items = store[type]
      items.unshift(item)
      if (type === settingMap.history && items.length > maxHistory) {
        store.removeOldHistoryFromDb(copy(items))
        items = items.slice(0, maxHistory)
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

    editItem (id, update, type) {
      const items = store[type]
      const item = _.find(items, t => t.id === id)
      if (!item) {
        return
      }
      // let index = _.findIndex(items, t => t.id === id)
      Object.assign(item, update)
      if (dbNames.includes(type)) {
        dbAction(type, 'update', {
          _id: id
        }, update)
      }
    },

    delItem ({ id }, type) {
      store[type] = store[type].filter(t => {
        return t.id !== id
      })
      if (dbNames.includes(type)) {
        dbAction(type, 'remove', {
          _id: id
        })
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
