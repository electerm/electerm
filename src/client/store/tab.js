/**
 * tabs related functions
 */

import newTerm from '../common/new-terminal'
import _ from 'lodash'
import { nanoid as generate } from 'nanoid/non-secure'
import copy from 'json-deep-copy'
import wait from '../common/wait'
import getInitItem from '../common/init-setting-item'
import {
  statusMap
} from '../common/constants'

const defaultStatus = statusMap.processing

export default store => {
  Object.assign(store, {
    addTab (tab = newTerm(store.tabs.length), index = store.tabs.length) {
      store.currentTabId = tab.id
      store.tabs.splice(index, 0, tab)
    },

    editTab (id, update) {
      store.editItem(id, update, 'tabs')
    },

    delTab ({ id }) {
      const { currentTabId, tabs } = store
      if (currentTabId === id) {
        let i = _.findIndex(tabs, t => {
          return t.id === id
        })
        i = i ? i - 1 : i + 1
        const next = tabs[i] || {}
        store.currentTabId = next.id
      }
      store.tabs = store.tabs.filter(t => {
        return t.id !== id
      })
    },

    async reloadTab (tabToReload) {
      const tab = copy(
        tabToReload
      )
      const { id } = tab
      tab.id = generate()
      tab.status = statusMap.processing
      const { tabs } = store
      const index = _.findIndex(tabs, t => t.id === id)
      store.delTab({ id: tabToReload.id })
      await wait(30)
      store.addTab(tab, index)
    },

    onDuplicateTab (tab) {
      const index = _.findIndex(
        store.tabs,
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
    },
    onChangeTab (tab) {
      const arr = store.getItems(tab)
      const item = getInitItem(arr, tab)
      store.storeAssign({
        settingItem: item,
        autofocustrigger: +new Date(),
        tab
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
