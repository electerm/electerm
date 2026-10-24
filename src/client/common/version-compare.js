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
export default function (a, b) {
  const ar = a.split('.').map(n => Number(n.replace('v', '')))
  const br = b.split('.').map(n => Number(n.replace('v', '')))
  // compare every part of the longer version, a missing part counts as 0,
  // so '1.0' < '1.0.1' and '1.0.0' === '1.0'
  const len = Math.max(ar.length, br.length)
  for (let i = 0; i < len; i++) {
    const x = ar[i] || 0
    const y = br[i] || 0
    if (x > y) {
      return 1
    } else if (x < y) {
      return -1
    }
  }
  return 0
}
