/**
 * batch input functions
 */

import copy from 'json-deep-copy'
import { maxBatchInput, batchInputLsKey } from '../common/constants'
import _ from 'lodash'
import * as ls from '../common/safe-local-storage'

export default store => {
  Object.assign(store, {
    addBatchInput (str) {
      let batchInputs = copy(store.batchInputs)
      batchInputs.push(str)
      batchInputs = _.uniq(batchInputs)
      const len = batchInputs.length
      if (len > maxBatchInput) {
        batchInputs = batchInputs.slice(len - maxBatchInput)
      }
      ls.setItemJSON(batchInputLsKey, batchInputs)
      store.batchInputs = batchInputs
    },
    clearBatchInput () {
      store.batchInputs = []
    }
  })
}
