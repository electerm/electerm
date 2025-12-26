/**
 * workspace related functions
 */

import {
  settingMap
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import generate from '../common/uid'

export default Store => {
  /**
   * Get current workspace state (layout + tabs for each batch)
   */
  Store.prototype.getCurrentWorkspaceState = function () {
    const { store } = window
    const { layout, tabs } = store
    // Group tabs by batch and get bookmark srcIds
    const tabsByBatch = {}
    for (const tab of tabs) {
      const batch = tab.batch || 0
      if (!tabsByBatch[batch]) {
        tabsByBatch[batch] = []
      }
      // Store srcId (bookmark id) if available, otherwise store basic connection info
      if (tab.srcId) {
        tabsByBatch[batch].push({
          srcId: tab.srcId
        })
      }
    }
    return {
      layout,
      tabsByBatch
    }
  }

  /**
   * Save current workspace
   */
  Store.prototype.saveWorkspace = function (name, id = null) {
    const { store } = window
    const state = store.getCurrentWorkspaceState()
    const workspace = {
      id: id || generate(),
      name,
      ...state,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    if (id) {
      // Update existing
      store.editItem(id, workspace, settingMap.workspaces)
    } else {
      // Add new
      store.addItem(workspace, settingMap.workspaces)
    }
    return workspace
  }

  /**
   * Load a workspace - set layout and open tabs
   */
  Store.prototype.loadWorkspace = function (workspaceId) {
    const { store } = window
    const workspace = store.workspaces.find(w => w.id === workspaceId)
    if (!workspace) {
      return
    }
    const { layout, tabsByBatch } = workspace

    // Close all existing tabs first
    store.removeTabs(() => true)

    // Set layout
    store.setLayout(layout)
    // Open tabs for each batch
    for (const [batchStr, tabInfos] of Object.entries(tabsByBatch)) {
      const batch = parseInt(batchStr, 10)
      for (const tabInfo of tabInfos) {
        if (tabInfo.srcId) {
          // Open from bookmark
          window.openTabBatch = batch
          store.onSelectBookmark(tabInfo.srcId)
        }
      }
    }
  }

  /**
   * Delete a workspace
   */
  Store.prototype.deleteWorkspace = function (id) {
    window.store.delItem({ id }, settingMap.workspaces)
  }

  /**
   * Open workspace settings
   */
  Store.prototype.openWorkspaceSettings = function () {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.workspaces
    })
    store.setSettingItem(getInitItem([], settingMap.workspaces))
    store.openSettingModal()
  }
}
