/**
 * version compare
 * @param {string} a
 * @param {string} b
 * @return {number}
 */
// compare version '1.0.0' '12.0.3'
// return 1 when a > b
// return -1 when a < b
// return 0 when a === b
module.exports = exports.default = function (a, b) {
  const ar = a.split('.').map(n => Number(n.replace('v', '')))
  const br = b.split('.').map(n => Number(n.replace('v', '')))
  let res = 0
  for (let i = 0, len = br.length; i < len; i++) {
    if (br[i] < ar[i]) {
      res = 1
      break
    } else if (br[i] > ar[i]) {
      res = -1
      break
    }
  }
  return res
}
