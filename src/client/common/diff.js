
/**
 * collect diff props
 */
import _ from 'lodash'
export default (obj, oldObj) => {
  return Object.keys(obj).reduce((prev, k) => {
    const v = obj[k]
    const v2 = oldObj[k]
    if (!_.isEqual(v, v2)) {
      prev[k] = v
    }
    return prev
  }, {})
}
