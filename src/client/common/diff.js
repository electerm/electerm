
/**
 * collect diff props
 */
import _ from 'lodash'
export default (obj, oldObj) => {
  return Object.keys(obj).reduce((prev, k) => {
    let v = obj[k]
    let v2 = oldObj[k]
    if (!_.isEqual(v, v2)) {
      prev[k] = v
    }
    return prev
  }, {})
}
