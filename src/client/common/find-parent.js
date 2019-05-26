/**
 * find the target parentNode
 * @param {Node} node
 * @param {String} className
 * @return {Boolean}
 */
export default function findParentBySel (node, sel) {
  if (!node) {
    return false
  }
  let parent = node
  if (!parent || !parent.matches) {
    return false
  }
  if (parent.matches(sel)) {
    return parent
  }
  let res = false
  while (parent !== document.body) {
    parent = parent.parentNode
    if (!parent || !parent.matches) {
      break
    }
    if (parent.matches(sel)) {
      res = parent
      break
    }
  }
  return res
}
