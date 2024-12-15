/**
 * tabs related functions
 */

import { debounce } from 'lodash-es'
import {
  splitConfig,
  statusMap,
  paneMap
} from '../common/constants'
import * as ls from '../common/safe-local-storage'
import deepCopy from 'json-deep-copy'
import generate from '../common/id-with-stamp'
import newTerm from '../common/new-terminal.js'

export default Store => {
  Store.prototype.getTabs = function () {
    return window.store.tabs
  }

  Store.prototype.setOffline = function () {
    const { store } = window
    store.tabs.forEach(tab => {
      if (tab.host && tab.status !== statusMap.error) {
        tab.status = statusMap.error
      }
    })
  }

  Store.prototype.updateTabsStatus = function () {
    const { store } = window
    const tabIdSet = new Set(
      store.fileTransfers.map(d => d.tabId)
    )
    store.tabs.forEach(tab => {
      tab.isTransporting = tabIdSet.has(tab.id)
    })
  }

  Store.prototype.updateStoreTabs = function (tabs0, batch0) {
    const { store } = window
    if (!tabs0.length && batch0 !== undefined) {
      // const tabs = window.store.tabs.filter(t => t.batch !== batch0)
      // window.store.setTabs(tabs)
      store.removeTabs(t => t.batch !== batch0)
      return true
    }
    if (!tabs0.length) {
      return false
    }
    const { batch } = tabs0[0]
    store.removeTabs(t => t.batch !== batch)
    store.tabs.push(...tabs0)
  }

  Store.prototype.setTabs = function (list) {
    window.store.tabs = list
  }

  Store.prototype.delTab = function (id) {
    return window.store.removeTabs({ id })
  }

  Store.prototype.closeTabsRight = function (id) {
    const { store } = window
    const { tabs } = store
    const targetTab = tabs.find(t => t.id === id)
    if (!targetTab) {
      return
    }
    const targetBatch = targetTab.batch
    const targetIndex = tabs.findIndex(t => t.id === id)

    // Remove all tabs in the same batch that are to the right
    for (let i = tabs.length - 1; i > targetIndex; i--) {
      const closingTab = tabs[i]
      if (closingTab.batch === targetBatch) {
        // Handle current tab closure
        if (closingTab.id === store.currentTabId) {
          store.currentTabId = id
        } else if (closingTab.id === store[`currentTabId${targetBatch}`]) {
          store[`currentTabId${targetBatch}`] = id
        }

        tabs.splice(i, 1)
      }
    }
  }

  Store.prototype.reloadTab = function (tabId = window.store.currentTabId) {
    const { store } = window
    const { tabs } = store
    const index = tabs.findIndex(t => t.id === tabId)

    // If tab not found, do nothing
    if (index === -1) {
      return
    }

    const oldTab = tabs[index]

    // Create copy of old tab with new ID
    const newTab = {
      ...oldTab,
      id: generate(), // Need to create new ID
      status: statusMap.processing // Reset status
    }

    // Add new tab at next index
    tabs.splice(index + 1, 0, newTab)

    // Remove old tab
    tabs.splice(index, 1)

    // Update current tab ID if needed
    if (store.currentTabId === tabId) {
      store.currentTabId = newTab.id
    }

    // Update batch current tab ID if needed
    const batchProp = `currentTabId${oldTab.batch}`
    if (store[batchProp] === tabId) {
      store[batchProp] = newTab.id
    }
  }

  Store.prototype.duplicateTab = function (tabId) {
    const { store } = window
    const { tabs } = store

    // Find the target tab and its index
    const targetIndex = tabs.findIndex(t => t.id === tabId)
    if (targetIndex === -1) {
      return
    }

    const sourceTab = tabs[targetIndex]
    const duplicatedTab = {
      ...deepCopy(sourceTab),
      id: generate(),
      status: statusMap.processing,
      isTransporting: undefined
    }

    // Insert the duplicated tab after the source tab
    tabs.splice(targetIndex + 1, 0, duplicatedTab)

    // Set the duplicated tab as current
    store.currentTabId = duplicatedTab.id
    store[`currentTabId${sourceTab.batch}`] = duplicatedTab.id
  }

  Store.prototype.closeOtherTabs = function (id) {
    const { store } = window
    const { tabs } = store
    const targetTab = tabs.find(t => t.id === id)
    if (!targetTab) {
      return
    }
    const currentBatch = targetTab.batch

    for (let i = tabs.length - 1; i >= 0; i--) {
      const tab = tabs[i]
      if (tab.batch === currentBatch && tab.id !== id) {
        if (tab.id === store.currentTabId) {
          store.currentTabId = id
        }
        if (tab.id === store[`currentTabId${currentBatch}`]) {
          store[`currentTabId${currentBatch}`] = id
        }
        tabs.splice(i, 1)
      }
    }
  }

  Store.prototype.removeTabs = function (condition) {
    const { tabs } = window.store
    const removedIds = []

    if (typeof condition === 'function') {
      for (let i = tabs.length - 1; i >= 0; i--) {
        const tab = tabs[i]
        if (condition(tab, i)) {
          removedIds.push(tab.id)
          tabs.splice(i, 1)
        }
      }
    } else {
      const keys = Object.keys(condition)
      if (keys.length === 1) {
        const key = keys[0]
        const value = condition[key]
        for (let i = tabs.length - 1; i >= 0; i--) {
          const tab = tabs[i]
          if (tab[key] === value) {
            removedIds.push(tab.id)
            tabs.splice(i, 1)
          }
        }
      } else {
        for (let i = tabs.length - 1; i >= 0; i--) {
          let match = true
          const tab = tabs[i]
          for (const key in condition) {
            if (tab[key] !== condition[key]) {
              match = false
              break
            }
          }
          if (match) {
            removedIds.push(tab.id)
            tabs.splice(i, 1)
          }
        }
      }
    }

    if (removedIds.length) {
      window.store.fixCurrentTabIds(tabs, removedIds)
    }
  }

  Store.prototype.fixCurrentTabIds = function (remainingTabs, removedIds) {
    const store = window.store
    const removedSet = new Set(removedIds)
    const batchFirstTabs = {}

    // Get first valid tab and fix batch currentTabIds
    for (const tab of remainingTabs) {
      if (!batchFirstTabs[tab.batch]) {
        batchFirstTabs[tab.batch] = tab.id
      }
    }

    // Fix currentTabIds
    const currentIdNeedFix = removedSet.has(store.currentTabId)
    for (let i = 0; i < 3; i++) {
      const tabId = `currentTabId${i}`
      if (removedSet.has(tabId)) {
        const fid = batchFirstTabs[i]
        store[tabId] = fid || ''
        if (currentIdNeedFix && fid) {
          store.currentTabId = fid
        }
      }
    }
  }

  Store.prototype.initFirstTab = function (batch) {
    const { store } = window
    if (batch !== undefined) {
      const newTab = newTerm()
      newTab.batch = batch // Set batch number
      store.addTab(newTab)
      return
    }
    const { layout } = store
    const batchCount = splitConfig[layout].children || 1
    for (let i = 0; i < batchCount; i++) {
      const newTab = newTerm()
      newTab.batch = i // Set batch number
      store.addTab(newTab)
    }
  }

  Store.prototype.updateTab = function (id, update) {
    const { store } = window
    const { tabs } = store

    // Find the target tab
    const targetIndex = tabs.findIndex(t => t.id === id)
    if (targetIndex === -1) {
      return
    }

    // Directly update the tab properties
    Object.assign(tabs[targetIndex], update)
  }

  Store.prototype.clickTab = function (id, batch) {
    const { store } = window

    // Update current batch
    store.currentLayoutBatch = batch

    // Update current tab id
    store.currentTabId = id

    // Update batch-specific current tab id
    store[`currentTabId${batch}`] = id
  }

  Store.prototype.addTab = function (
    newTab = newTerm(),
    index,
    batch
  ) {
    const { store } = window
    const { tabs } = store
    newTab.batch = batch ?? newTab.batch ?? window.openTabBatch ?? window.store.currentLayoutBatch
    if (typeof index === 'number' && index >= 0 && index <= tabs.length) {
      tabs.splice(index, 0, newTab)
    } else {
      tabs.push(newTab)
    }
    const batchNum = newTab.batch
    store[`currentTabId${batchNum}`] = newTab.id
    store.currentTabId = newTab.id
    store.currentLayoutBatch = batchNum
  }

  Store.prototype.clickNextTab = debounce(function () {
    window.store.clickBioTab(1)
  }, 100)

  Store.prototype.clickPrevTab = debounce(function () {
    window.store.clickBioTab(-1)
  }, 100)

  Store.prototype.clickBioTab = function (diff) {
    const { store } = window
    const { tabs, currentTabId } = store

    // Find the current tab index and its batch
    const currentIndex = tabs.findIndex(t => t.id === currentTabId)
    if (currentIndex === -1) return // Current tab not found, do nothing

    const currentBatch = tabs[currentIndex].batch

    // Function to find the next valid tab index
    const findNextTabIndex = (startIndex, direction) => {
      let nextIndex = startIndex
      do {
        nextIndex = (nextIndex + direction + tabs.length) % tabs.length
        if (tabs[nextIndex].batch === currentBatch) {
          return nextIndex
        }
      } while (nextIndex !== startIndex)
      return -1 // No other tabs in the same batch
    }

    // Find the next tab index
    const nextIndex = findNextTabIndex(currentIndex, diff)

    // If a valid next tab is found, update the currentTabId
    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      store.currentTabId = tabs[nextIndex].id
    }
  }

  Store.prototype.cloneToNextLayout = function (tab = window.store.currentTab) {
    if (!tab) {
      return
    }
    const { store } = window
    const defaultStatus = statusMap.processing
    const { layout, currentLayoutBatch } = store
    const ntb = deepCopy(tab)
    Object.assign(ntb, {
      id: generate(),
      status: defaultStatus,
      isTransporting: undefined,
      pane: paneMap.terminal
    })
    let maxBatch = splitConfig[layout].children
    if (maxBatch < 2) {
      maxBatch = 2
    }
    ntb.batch = (currentLayoutBatch + 1) % maxBatch
    if (layout === 'c1') {
      store.setLayout('c2')
    }
    store.addTab(ntb)
  }

  Store.prototype.setLayout = function (layout) {
    const { store } = window
    const prevLayout = store.layout
    const { currentTabId } = store

    // If layout hasn't changed, do nothing
    if (prevLayout === layout) {
      return
    }

    // Update layout related properties
    store.prevLayout = prevLayout
    ls.setItem('layout', layout)
    store.layout = layout

    // Get the number of batches in new and previous layouts
    const newBatchCount = splitConfig[layout].children
    const prevBatchCount = prevLayout ? splitConfig[prevLayout].children : 0

    // If new layout has fewer batches, we need to adjust tabs
    if (newBatchCount < prevBatchCount) {
      const nb = newBatchCount - 1
      // Directly modify tabs that exceed the new batch count
      for (let i = 0; i < store.tabs.length; i++) {
        const tab = store.tabs[i]
        if (tab.batch >= newBatchCount) {
          store.tabs[i].batch = nb
          if (tab.id === currentTabId) {
            store[`currentTabId${nb}`] = currentTabId
          }
        }
      }

      // Adjust currentLayoutBatch if needed
      if (store.currentLayoutBatch >= newBatchCount) {
        store.currentLayoutBatch = newBatchCount - 1
      }
    }
  }
}
