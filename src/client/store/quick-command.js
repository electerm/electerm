/**
 * quick command related functions
 */

import copy from 'json-deep-copy'
import _ from 'lodash'

export default store => {
  Object.assign(store, {
    get currentQuickCommands () {
      const { currentTab, quickCommands } = store
      const currentTabQuickCommands = _.get(
        currentTab, 'quickCommands'
      ) || []
      return [
        ...currentTabQuickCommands,
        ...copy(quickCommands)
      ]
    }
  })
}
