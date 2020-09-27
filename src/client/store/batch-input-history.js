/**
 * batch input functions
 */

import copy from 'json-deep-copy'
import { maxBatchInput } from '../common/constants'

export default store => {
  Object.assign(store, {
    addBatchInput (str) {
      let batchInputs = copy(store.batchInputs)
      batchInputs.push(str)
      if (batchInputs.length > maxBatchInput) {
        batchInputs = batchInputs.slice(0, maxBatchInput)
      }
      store.batchInputs = batchInputs
    },
    clearBatchInput () {
      store.batchInputs = []
    }
  })
}
