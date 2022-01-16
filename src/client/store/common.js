/**
 * common functions
 */

import handleError from '../common/error-handler'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  statusMap,
  sidebarWidth
} from '../common/constants'

export default store => {
  Object.assign(store, {
    storeAssign (updates) {
      Object.assign(store, updates)
    },

    setOffline () {
      store.tabs = store.tabs
        .map(t => {
          return {
            ...t,
            status: t.host ? statusMap.error : t.status
          }
        })
    },

    onError (e) {
      handleError(e)
    },

    updateConfig (ext) {
      store.config = {
        ...copy(store.config),
        ...ext
      }
    }
  })

  store.onResize = _.debounce(async () => {
    const { width, height } = await window.pre.runGlobalAsync('getScreenSize')
    const isMaximized = await window.pre.runGlobalAsync('isMaximized')
    const update = {
      height: window.innerHeight,
      width: window.innerWidth,
      screenWidth: width,
      screenHeight: height,
      isMaximized
    }
    const stateUpdate = copy(update)
    stateUpdate.width = stateUpdate.width - sidebarWidth
    store.storeAssign(stateUpdate)
    window.pre.runGlobalAsync('setWindowSize', update)
  }, 100)
}
