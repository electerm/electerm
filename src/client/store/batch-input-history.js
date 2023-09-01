/**
 * batch input functions
 */

import copy from 'json-deep-copy'
import { maxBatchInput, batchInputLsKey } from '../common/constants'
import { uniq } from 'lodash-es'
import * as ls from '../common/safe-local-storage'

export default Store => {
  Store.prototype.addBatchInput = function (str) {
    let batchInputs = copy(window.store.batchInputs)
    batchInputs.push(str)
    batchInputs = uniq(batchInputs)
    const len = batchInputs.length
    if (len > maxBatchInput) {
      batchInputs = batchInputs.slice(len - maxBatchInput)
    }
    ls.setItemJSON(batchInputLsKey, batchInputs)
    window.store.batchInputs = batchInputs
  }
  Store.prototype.clearBatchInput = function () {
    window.store.batchInputs = []
    ls.setItemJSON(batchInputLsKey, [])
  }
}
