/**
 * common db op
 */

import { find } from 'lodash-es'
import deepCopy from 'json-deep-copy'
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
    const items = store.getItems(type)
    items.push(...objs)
  }

  Store.prototype.editItem = function (id, updates, type) {
    const { store } = window
    const items = store.getItems(type)
    const item = find(items, t => t.id === id)
    if (!item) {
      return
    }
    Object.assign(item, updates)
  }

  Store.prototype.delItem = function ({ id }, type) {
    const { store } = window
    const items = store.getItems(type)
    const index = items.findIndex(t => t.id === id)
    if (index < 0) {
      return
    }
    items.splice(index, 1)
  }

  Store.prototype.delItems = function (ids, type) {
    const { store } = window
    const items = store.getItems(type)
    for (let i = items.length - 1; i >= 0; i--) {
      if (ids.includes(items[i].id)) {
        items.splice(i, 1)
      }
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
      return deepCopy([
        ...store.getTerminalThemes(),
        ...store.itermThemes
      ]).sort(window.store.sortTheme)
    }
    return deepCopy(store.getItems(type))
  }

  Store.prototype.getItems = function (type) {
    if (type === 'setting') {
      return window.store.setting
    }
    return window.store[type]
  }

  Store.prototype.setItems = function (type, arr) {
    window.store[type] = arr
  }

  Store.prototype.adjustOrder = function (type, fromId, toId) {
    const { store } = window
    const items = store.getItems(type)
    const fromIndex = items.findIndex(t => t.id === fromId)
    let toIndex = items.findIndex(t => t.id === toId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return
    }
    if (fromIndex < toIndex) {
      toIndex = toIndex - 1
    }
    const [removed] = items.splice(fromIndex, 1)
    items.splice(toIndex, 0, removed)
  }
}
