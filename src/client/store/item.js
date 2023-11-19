/**
 * common db op
 */

import { find } from 'lodash-es'
import {
  maxHistory,
  settingMap
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import { update, remove, dbNames } from '../common/db'
import copy from 'json-deep-copy'

export default Store => {
  Store.prototype.removeOldHistoryFromDb = function (items) {
    const arr = items.slice(maxHistory).map(k => {
      return {
        db: 'history',
        id: k.id
      }
    })
    window.store.batchDbDel(arr)
  }

  Store.prototype.addItem = function (item, type) {
    return window.store.addItems([item], type)
  }

  Store.prototype.addItems = function (objs, type) {
    const { store } = window
    let items = store.getItems(type)
    items = [
      ...objs,
      ...items
    ]
    if (type === settingMap.history && items.length > maxHistory) {
      store.removeOldHistoryFromDb(
        copy(items)
      )
      items.slice(0, maxHistory)
    }
    store.setItems(type, items)
    if (dbNames.includes(type)) {
      store.batchDbAdd(
        objs.map(obj => {
          return {
            db: type,
            obj
          }
        })
      )
    }
  }

  Store.prototype.editItem = function (id, updates, type) {
    const { store } = window
    const items = store.getItems(type)
    const item = find(items, t => t.id === id)
    if (!item) {
      return
    }
    // let index = findIndex(items, t => t.id === id)
    Object.assign(item, updates)
    store.setItems(type, items)
    if (dbNames.includes(type)) {
      update(id, updates, type, false)
    }
  }

  Store.prototype.delItem = function ({ id }, type) {
    const { store } = window
    const items = store.getItems(type).filter(t => {
      return t.id !== id
    })
    store.setItems(type, items)
    if (dbNames.includes(type)) {
      remove(type, id)
    }
  }

  Store.prototype.delItems = function (ids, type) {
    const { store } = window
    const items = store.getItems(type).filter(t => {
      return !ids.includes(t.id)
    })
    store.setItems(type, items)
    if (dbNames.includes(type)) {
      ids.map(id => remove(type, id))
    }
  }

  Store.prototype.onDelItem = function (item, type) {
    const { store } = window
    if (item.id === store.settingItem.id) {
      store.setSettingItem(getInitItem(
        store.getItems(type),
        type
      ))
    }
  }

  Store.prototype.getSidebarList = function (type) {
    const { store } = window
    if (type === settingMap.terminalThemes) {
      return [
        ...store.getTerminalThemes(),
        ...store.itermThemes
      ].sort(window.store.sortTheme)
    }
    return store.getItems(type)
  }

  Store.prototype.getItems = function (type) {
    if (type === 'setting') {
      return window.store.setting
    }
    return JSON.parse(this['_' + type] || [])
  }

  Store.prototype.setItems = function (type, items) {
    this['_' + type] = JSON.stringify(items)
  }
}
