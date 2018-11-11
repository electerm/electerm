
import _ from 'lodash'

function recToJSON (obj) {
  let res = obj.toJSON()
  return Object.keys(res).reduce((prev, k) => {
    let v = res[k]
    if (_.isObject(v)) {
      v = recToJSON(v)
    }
    prev[k] = v
    return prev
  }, {})
}

export default recToJSON
