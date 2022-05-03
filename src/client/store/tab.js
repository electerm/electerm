/**
 * tabs related functions
 */

import newTerm from '../common/new-terminal'
import _ from 'lodash'
import generate from '../common/uid'
import copy from 'json-deep-copy'
import wait from '../common/wait'
// import getInitItem from '../common/init-setting-item'
import {
  statusMap
} from '../common/constants'

const defaultStatus = statusMap.processing

export default store => {
  Object.assign(store, {

    updateTabsStatus () {
      const tabIds = _.uniq(
        store.getTransfers().map(d => d.tabId)
      )
      const tabs = store.getTabs().map(d => {
        return {
          ...d,
          isTransporting: tabIds.includes(d.id)
        }
      })
      store.setTabs(tabs)
    },

    getTabs () {
      return store.getItems('tabs')
    },

    setTabs (list) {
      return store.setItems('tabs', list)
    },

    initFirstTab () {
      const tab = newTerm(store.tabs.length)
      tab.terminals = [{
        id: 'electerm-init-term',
        position: 0
      }]
      store.addTab(tab)
    },

    addTab (
      tab = newTerm(store.tabs.length),
      index = store.tabs.length
    ) {
      store.currentTabId = tab.id
      const tabs = store.getItems('tabs')
      tabs.splice(index, 0, tab)
      store.setItems('tabs', tabs)
    },

    editTab (id, update) {
      store.editItem(id, update, 'tabs')
    },

    delTab ({ id }) {
      const tabs = store.getItems('tabs')
      const { currentTabId } = store
      if (currentTabId === id) {
        let i = _.findIndex(tabs, t => {
          return t.id === id
        })
        i = i ? i - 1 : i + 1
        const next = tabs[i] || {}
        store.currentTabId = next.id
      }
      const narr = tabs.filter(t => {
        return t.id !== id
      })
      store.setItems(
        'tabs',
        narr
      )
      if (narr.length <= 1) {
        setTimeout(store.addTab, 1)
      }
    },

    processTerminals (tab) {
      if (!tab.terminals) {
        return tab
      }
      tab.terminals = tab.terminals.map(t => {
        return {
          ...t,
          stateId: t.id,
          id: generate()
        }
      })
    },

    async reloadTab (tabToReload) {
      const tab = copy(
        tabToReload
      )
      store.processTerminals(tab)
      const { id } = tab
      const tabs = store.getItems('tabs')
      tab.id = generate()
      tab.status = statusMap.processing
      const index = _.findIndex(tabs, t => t.id === id)
      store.delTab({ id: tabToReload.id })
      await wait(30)
      store.addTab(tab, index)
    },

    onDuplicateTab (tabToDup) {
      const tab = copy(tabToDup)
      store.processTerminals(tab)
      const tabs = store.getItems('tabs')
      const index = _.findIndex(
        tabs,
        d => d.id === tab.id
      )
      store.addTab({
        ...tab,
        status: defaultStatus,
        id: generate(),
        isTransporting: undefined
      }, index + 1)
    },

    onChangeTabId (currentTabId) {
      store.currentTabId = currentTabId
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
