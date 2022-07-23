/**
 * tabs related functions
 */

import _ from 'lodash'
import {
  tabActions
} from '../common/constants'
import postMsg from '../common/post-msg'

export default store => {
  Object.assign(store, {

    updateTabsStatus () {
      const tabIds = _.uniq(
        store.getTransfers().map(d => d.tabId)
      )
      postMsg({
        action: tabActions.updateTabsStatus,
        tabIds
      })
    },

    getTabs () {
      return store.getItems('tabs')
    },

    setTabs (list) {
      return store.setItems('tabs', list)
    },

    initFirstTab () {
      postMsg({
        action: tabActions.initFirstTab
      })
    },

    addTab (
      tab,
      index
    ) {
      postMsg({
        action: tabActions.addTab,
        tab,
        index
      })
    }
  })

  store.clickNextTab = _.debounce(() => {
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
