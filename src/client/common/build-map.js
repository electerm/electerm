/**
 * build id -> item Map from array
 * O(n), unlike reduce + object spread which is O(n²)
 */

export default (arr = [], key = 'id') => {
  const map = new Map()
  for (const item of arr) {
    map.set(item[key], item)
  }
  return map
}
