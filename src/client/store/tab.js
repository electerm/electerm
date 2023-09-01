/**
 * tabs related functions
 */

import { uniq, debounce, findIndex } from 'lodash-es'
import {
  tabActions
} from '../common/constants'
import postMsg from '../common/post-msg'

export default Store => {
  Store.prototype.updateTabsStatus = function () {
    const tabIds = uniq(
      window.store.getTransfers().map(d => d.tabId)
    )
    postMsg({
      action: tabActions.updateTabsStatus,
      tabIds
    })
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
}
