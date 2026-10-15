/**
 * create bookmark group tree data
 */

import buildMap from '../../../common/build-map.js'
import { mapBookmarkGroupTree } from '../../../common/bookmark-group-tree.js'

export default (bookmarkGroups = [], disabledId = '', returnMap = false, currentParentId = '') => {
  const btree = buildMap(bookmarkGroups)
  // every group is listed, empty ones included: this tree picks a *target*
  // group, so a group holding no bookmarks is a perfectly good answer
  const tree = mapBookmarkGroupTree(bookmarkGroups, {
    mapGroup: (group, children) => {
      const node = {
        key: group.id,
        value: group.id,
        title: group.title,
        disabled: group.id === disabledId || group.id === currentParentId
      }
      if (children.length) {
        node.children = children
      }
      return node
    }
  })
  if (returnMap) {
    return [tree, btree]
  }
  return tree
}
