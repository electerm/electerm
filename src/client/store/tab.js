/**
 * tabs related functions
 */

import _ from 'lodash'
import {
  tabActions
} from '../common/constants'
import postMsg from '../common/post-msg'

export default Store => {
  Store.prototype.updateTabsStatus = function () {
    const tabIds = _.uniq(
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

  Store.prototype.clickNextTab = _.debounce(function () {
    const tab = document.querySelector('.tabs-wrapper .tab.active')
    if (tab) {
      let next = tab.nextSibling
      if (!next || !next.classList.contains('tab')) {
        next = document.querySelector('.tabs-wrapper .tab')
      }
      next &&
      next.querySelector('.tab-title') &&
      next.querySelector('.tab-title').click()
    }
  }, 100)
}
