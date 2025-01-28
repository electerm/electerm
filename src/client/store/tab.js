/**
 * tabs related functions
 */

import { debounce, isEqual } from 'lodash-es'
import {
  splitConfig,
  statusMap,
  paneMap,
  maxHistory
} from '../common/constants'
import { refs } from '../components/common/ref'
import * as ls from '../common/safe-local-storage'
import deepCopy from 'json-deep-copy'
import generate from '../common/id-with-stamp'
import uid from '../common/uid'
import newTerm, { updateCount } from '../common/new-terminal.js'
import { action } from 'manate'

export default Store => {
  Store.prototype.nextTabCount = function () {
    return updateCount()
  }

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
      const t = tabIdSet.has(tab.id)
      if (Boolean(tab.isTransporting) !== t) {
        tab.isTransporting = t
      }
    })
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
        if (closingTab.id === store.activeTabId) {
          store.activeTabId = id
        } else if (closingTab.id === store[`activeTabId${targetBatch}`]) {
          store[`activeTabId${targetBatch}`] = id
        }

        tabs.splice(i, 1)
      }
    }
  }

  Store.prototype.reloadTab = function (tabId = window.store.activeTabId) {
    const { store } = window
    const { tabs } = store
    const index = tabs.findIndex(t => t.id === tabId)

    // If tab not found, do nothing
    if (index === -1) {
      return
    }

    const oldTab = tabs[index]
    const oldBatch = oldTab.batch

    // Create copy of old tab with new ID
    const newTab = {
      ...oldTab,
      tabCount: store.nextTabCount(),
      id: generate(), // Need to create new ID
      status: statusMap.processing // Reset status
    }

    // Add new tab at next index
    tabs.splice(index + 1, 0, newTab)
    store.updateHistory(newTab)

    // Remove old tab
    tabs.splice(index, 1)

    setTimeout(() => {
      if (store.activeTabId === tabId) {
        store.activeTabId = newTab.id
      }

      // Update batch current tab ID if needed
      const batchProp = `activeTabId${oldBatch}`
      if (store[batchProp] === tabId) {
        store[batchProp] = newTab.id
      }
    }, 0)
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
      tabCount: store.nextTabCount(),
      status: statusMap.processing,
      isTransporting: undefined
    }

    // Insert the duplicated tab after the source tab
    tabs.splice(targetIndex + 1, 0, duplicatedTab)
    store.updateHistory(duplicatedTab)

    // Set the duplicated tab as current
    store.activeTabId = duplicatedTab.id
    store[`activeTabId${sourceTab.batch}`] = duplicatedTab.id
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
        if (tab.id === store.activeTabId) {
          store.activeTabId = id
        }
        if (tab.id === store[`activeTabId${currentBatch}`]) {
          store[`activeTabId${currentBatch}`] = id
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
    const currentIdNeedFix = removedSet.has(store.activeTabId)

    // Get first valid tab for each batch
    for (const tab of remainingTabs) {
      if (!batchFirstTabs[tab.batch]) {
        batchFirstTabs[tab.batch] = tab.id
      }
    }

    // If current tab was removed, we need to set a new one
    if (currentIdNeedFix) {
      // Try to find current batch's first tab
      const currentTab = remainingTabs.find(t => t.id === store.activeTabId)
      const currentBatch = currentTab ? currentTab.batch : store.currentLayoutBatch
      const newCurrentId = batchFirstTabs[currentBatch] || batchFirstTabs[0] || ''

      if (newCurrentId) {
        store.activeTabId = newCurrentId
        // Also update the batch-specific current tab id
        store[`activeTabId${currentBatch}`] = newCurrentId
      } else {
        // No tabs left in any batch
        store.activeTabId = ''
      }
    }

    // Fix batch-specific current tab IDs
    for (const batch in batchFirstTabs) {
      const batchTabId = `activeTabId${batch}`
      const currentBatchId = store[batchTabId]

      // If the batch's current tab was removed or doesn't exist
      if (removedSet.has(currentBatchId) || !currentBatchId) {
        store[batchTabId] = batchFirstTabs[batch]
      }
    }
    store.focus()
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
    store.activeTabId = id

    // Update batch-specific current tab id
    store[`activeTabId${batch}`] = id
  }

  Store.prototype.addTab = function (
    newTab = newTerm(),
    index,
    batch
  ) {
    const { store } = window
    const { tabs } = store
    newTab.tabCount = store.nextTabCount()
    newTab.batch = batch ?? newTab.batch ?? window.openTabBatch ?? window.store.currentLayoutBatch
    if (typeof index === 'number' && index >= 0 && index <= tabs.length) {
      tabs.splice(index, 0, newTab)
    } else {
      tabs.push(newTab)
    }
    const batchNum = newTab.batch
    store[`activeTabId${batchNum}`] = newTab.id
    store.activeTabId = newTab.id
    store.currentLayoutBatch = batchNum
    store.updateHistory(newTab)
  }

  Store.prototype.clickNextTab = debounce(function () {
    window.store.clickBioTab(1)
  }, 100)

  Store.prototype.clickPrevTab = debounce(function () {
    window.store.clickBioTab(-1)
  }, 100)

  Store.prototype.clickBioTab = function (diff) {
    const { store } = window
    const { tabs, activeTabId } = store

    // Find the current tab index and its batch
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)

    if (currentIndex === -1) {
      return // Current tab not found, do nothing
    }

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

    // If a valid next tab is found, update the activeTabId
    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      store.activeTabId = tabs[nextIndex].id
      store[`activeTabId${currentBatch}`] = tabs[nextIndex].id
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
    const { activeTabId } = store

    // If layout hasn't changed, do nothing
    if (prevLayout === layout) {
      return store.focus()
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
          if (tab.id === activeTabId) {
            store[`activeTabId${nb}`] = activeTabId
          }
        }
      }

      // Adjust currentLayoutBatch if needed
      if (store.currentLayoutBatch >= newBatchCount) {
        store.currentLayoutBatch = newBatchCount - 1
      }
    }
    store.focus()
  }

  Store.prototype.changeActiveTabId = function (id) {
    const { store } = window
    const { tabs } = store
    const tab = tabs.find(t => t.id === id)
    if (!tab) {
      return
    }
    store.activeTabId = id
    store[`activeTabId${tab.batch}`] = id
    store.focus()
  }

  Store.prototype.updateHistory = function (tab) {
    if (
      !tab.type &&
      !tab.host
    ) {
      return
    }
    const { store } = window
    if (store.config.disableConnectionHistory) {
      return
    }
    const tabPropertiesExcludes = [
      'id',
      'from',
      'srcId',
      'status',
      'pane',
      'batch',
      'tabCount'
    ]
    const { history } = store
    const index = history.findIndex(d => {
      for (const key in tab) {
        if (tabPropertiesExcludes.includes(key)) {
          continue
        }
        if (!isEqual(d.tab[key], tab[key])) {
          return false
        }
      }
      return true
    })
    if (index === -1) {
      const copiedTab = deepCopy(tab)
      tabPropertiesExcludes.forEach(d => {
        delete copiedTab[d]
      })
      return history.unshift({
        tab: copiedTab,
        time: Date.now(),
        count: 1,
        id: uid()
      })
    }
    const match = history[index]
    match.count = (match.count || 0) + 1
    match.time = Date.now()
    action(function () {
      const [m] = history.splice(index, 1)
      history.unshift(m)
      if (history.length > maxHistory) {
        history.pop()
      }
    })()
  }

  Store.prototype.updateBatchInputSelectedTabIds = function () {
    const { store } = window
    store._batchInputSelectedTabIds = new Set([store.activeTabId])
  }

  Store.prototype.onSelectBatchInputSelectedTabId = action(function (id) {
    const { store } = window
    const { _batchInputSelectedTabIds } = store
    if (_batchInputSelectedTabIds.has(id)) {
      _batchInputSelectedTabIds.delete(id)
    } else {
      _batchInputSelectedTabIds.add(id)
    }
    if (_batchInputSelectedTabIds.size === 0) {
      _batchInputSelectedTabIds.add(store.activeTabId)
    }
  })

  Store.prototype.filterBatchInputSelectedTabIds = action(function () {
    const { store } = window
    const { _batchInputSelectedTabIds, tabs } = store
    const validTabIds = new Set(tabs.map(tab => tab.id))

    // Filter out invalid tab IDs
    for (const id of _batchInputSelectedTabIds) {
      if (!validTabIds.has(id)) {
        _batchInputSelectedTabIds.delete(id)
      }
    }

    // If no valid tabs are selected, add the active tab
    if (_batchInputSelectedTabIds.size === 0) {
      _batchInputSelectedTabIds.add(store.activeTabId)
    }
  })

  Store.prototype.selectAllBatchInputTabs = function () {
    const { store } = window
    const { tabs } = store
    store._batchInputSelectedTabIds = new Set(tabs.map(tab => tab.id))
  }

  Store.prototype.selectNoneBatchInputTabs = action(function () {
    const { store } = window
    store._batchInputSelectedTabIds.clear()
    // Ensure at least the active tab is selected
    store._batchInputSelectedTabIds.add(store.activeTabId)
  })

  Store.prototype.notifyTabOnData = function (tabId) {
    const tab = refs.get('tab-' + tabId)
    if (tab) {
      tab.notifyOnData()
    }
  }

  Store.prototype.remoteList = function (sessionId) {
    const sftp = refs.get('sftp-' + sessionId)
    if (sftp) {
      sftp.remoteListDebounce()
    }
  }

  Store.prototype.localList = function (sessionId) {
    const sftp = refs.get('sftp-' + sessionId)
    if (sftp) {
      sftp.localListDebounce()
    }
  }
}
