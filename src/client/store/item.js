/**
 * common db op
 */

import { find } from 'lodash-es'
import {
  settingMap
} from '../common/constants'
import getInitItem from '../common/init-setting-item'

export default Store => {
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
    store.setItems(type, items)
  }

  Store.prototype.editItem = function (id, updates, type) {
    const { store } = window
    const items = store.getItems(type)
    const item = find(items, t => t.id === id)
    if (!item) {
      return
    }
    Object.assign(item, updates)
    store.setItems(type, items)
  }

  Store.prototype.delItem = function ({ id }, type) {
    const { store } = window
    const items = store.getItems(type).filter(t => {
      return t.id !== id
    })
    store.setItems(type, items)
  }

  Store.prototype.delItems = function (ids, type) {
    const { store } = window
    const items = store.getItems(type).filter(t => {
      return !ids.includes(t.id)
    })
    store.setItems(type, items)
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
