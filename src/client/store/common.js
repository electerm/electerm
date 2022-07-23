/**
 * common functions
 */

import handleError from '../common/error-handler'
import _ from 'lodash'
import copy from 'json-deep-copy'
import postMessage from '../common/post-msg'
import {
  commonActions,
  tabActions
} from '../common/constants'

export default store => {
  Object.assign(store, {
    storeAssign (updates) {
      Object.assign(store, updates)
    },

    setOffline () {
      postMessage({
        action: tabActions.setAllTabOffline
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
    },

    openFileInfoModal (data) {
      postMessage({
        data,
        action: commonActions.showFileInfoModal
      })
    },

    openFileModeModal (data, file) {
      postMessage({
        data,
        file,
        action: commonActions.showFileModeModal
      })
    }
  })

  store.onResize = _.debounce(async () => {
    const { width, height } = await window.pre.runGlobalAsync('getScreenSize')
    const isMaximized = await window.pre.runGlobalAsync('isMaximized')
    const update = {
      height: window.innerHeight,
      innerWidth: window.innerWidth,
      screenWidth: width,
      screenHeight: height,
      isMaximized
    }
    store.storeAssign(update)
    window.pre.runGlobalAsync('setWindowSize', update)
  }, 100, {
    leading: true
  })
}
