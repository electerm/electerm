/**
 * tabs related functions
 */

import { uniq, debounce, findIndex } from 'lodash-es'
import {
  tabActions,
  splitConfig
} from '../common/constants'
import postMsg from '../common/post-msg'
import * as ls from '../common/safe-local-storage'
import deepCopy from 'json-deep-copy'

export default Store => {
  Store.prototype.updateTabsStatus = function () {
    const tabIds = uniq(
      window.store.fileTransfers.map(d => d.tabId)
    )
    postMsg({
      action: tabActions.updateTabsStatus,
      tabIds
    })
  }

  Store.prototype.updateStoreTabs = function (tabs0, batch0) {
    console.log('updateStoreTabs0', tabs0, batch0, window.store.getTabs())
    if (!tabs0.length && batch0 !== undefined) {
      const tabs = window.store.getTabs().filter(t => t.batch !== batch0)
      console.log('updateStoreTabs', tabs0, batch0, tabs)
      window.store.setTabs(tabs)
      return true
    }
    console.log('ffffff')
    if (!tabs0.length) {
      return false
    }
    console.log('ffffff1')
    const { batch } = tabs0[0]
    const tabs = window.store.getTabs()
      .filter(t => t.batch !== batch)
      .concat(deepCopy(tabs0))
    window.store.setTabs(tabs)
  }

  Store.prototype.getTabs = function () {
    return window.store.getItems('tabs')
  }

  Store.prototype.setTabs = function (list) {
    return window.store.setItems('tabs', list)
  }

  Store.prototype.initFirstTab = function () {
    postMsg({
      action: tabActions.initFirstTab
    })
  }

  Store.prototype.addTab = function (
    tab,
    index
  ) {
    postMsg({
      action: tabActions.addTab,
      tab,
      index
    })
  }

  Store.prototype.clickNextTab = debounce(function () {
    window.store.clickBioTab(1)
  }, 100)

  Store.prototype.clickPrevTab = debounce(function () {
    window.store.clickBioTab(-1)
  }, 100)

  Store.prototype.clickBioTab = function (diff) {
    const tab = document.querySelector('.tabs-wrapper .tab.active')
    if (tab) {
      const id = tab.dataset.id
      const { tabs } = window.store
      const i = findIndex(tabs, t => {
        return t.id === id
      })
      const len = tabs.length
      if (i >= 0) {
        const next = (i + diff + len) % len
        const nextTab = tabs[next]
        postMsg({
          action: tabActions.changeCurrentTabId,
          currentTabId: nextTab.id
        })
      }
    }
  }

  Store.prototype.setLayout = function (layout) {
    const {
      store
    } = window
    const prevLayout = store.layout
    if (prevLayout === layout) {
      return
    }
    store.prevLayout = prevLayout
    ls.setItem('layout', layout)
    console.log('setLayout', layout, prevLayout)
    store.layout = layout
    const len = splitConfig[layout].children
    const prevLen = prevLayout ? splitConfig[prevLayout].children : 0
    if (len < prevLen) {
      const {
        tabs
      } = store
      // Update tabs where batch > len - 1
      const updatedTabs = tabs.map(tab => {
        if (tab.batch > len - 1) {
          return { ...tab, batch: len - 1 }
        }
        return tab
      })
      // Set the updated tabs back to the store
      store.setTabs(updatedTabs)
    }
  }

  // Store.prototype.onLayoutChange = function () {
  //   const {
  //     store
  //   } = window
  //   const {
  //     layout,
  //     prevLayout
  //   } = store
  //   ls.setItem('layout', layout)
  //   console.log('onLayoutChange', layout, prevLayout)
  //   const len = splitConfig[layout].children
  //   const prevLen = prevLayout ? splitConfig[prevLayout].children : 0
  //   if (len < prevLen) {
  //     const {
  //       tabs
  //     } = store
  //     // Update tabs where batch > len - 1
  //     const updatedTabs = tabs.map(tab => {
  //       if (tab.batch > len - 1) {
  //         return { ...tab, batch: len - 1 }
  //       }
  //       return tab
  //     })
  //     // Set the updated tabs back to the store
  //     store.setTabs(updatedTabs)
  //   }
  // }
}
