/**
 * handle tree on drop event to support category drag/drop in any form
 */

import {
  defaultBookmarkGroupId
} from '../../common/constants'
import { isEqual, find, last, remove } from 'lodash-es'
import copy from 'json-deep-copy'
import { action } from 'manate'

export default action((info, props) => {
  const {
    dropToGap,
    dragNode,
    node,
    dropPosition
  } = info
  const fromId = dragNode.key
  const toId = node.key
  const fromPoses = dragNode.pos.split('-').map(Number)
  const fromPosesLevel = fromPoses.slice(0, fromPoses.length - 1)
  const toPoses = node.pos.split('-').map(Number)
  const toPosesLevel = toPoses.slice(0, toPoses.length - 1)
  const isSameLevel = fromPosesLevel.length === toPosesLevel.length
  const isSameCat = isEqual(fromPosesLevel, toPosesLevel) && dropToGap
  const { bookmarks, bookmarkGroups } = window.store
  let from = find(
    bookmarks,
    d => d.id === fromId
  ) || find(
    bookmarkGroups,
    d => d.id === fromId
  )
  const fromLeaf = !!from && !from.bookmarkIds
  let to = find(
    bookmarks,
    d => d.id === toId
  ) || find(
    bookmarkGroups,
    d => d.id === toId
  )
  const toLeaf = !!to && !to.bookmarkIds

  // no match
  if (!to || !from) {
    return
  }

  // // drop to a leaf
  // if (toLeaf && !dropToGap) {
  //   return
  // }

  // drag default cateogry to other level
  if (fromId === defaultBookmarkGroupId && !isSameLevel) {
    return
  }

  // drag default cateogry to nongap
  if (fromId === defaultBookmarkGroupId && !dropToGap) {
    return
  }

  // drag cateogry with subscategory to non gap
  if (!fromLeaf && !dropToGap && from.bookmarkGroupIds && from.bookmarkGroupIds.length) {
    return
  }

  // drag cat to level2 node
  if (!fromLeaf && toPoses.length > 2) {
    return
  }

  // drag node to first level
  if (fromLeaf && toPoses.length <= 2 && dropToGap) {
    return
  }

  // drag leaf node to cat gap
  if (fromLeaf && toPoses.length > 2 && dropToGap && !toLeaf) {
    return
  }

  // let's confirm the drop position
  to = copy(to)
  let fromGroup = null
  if (fromPoses.length > 2) {
    fromGroup = fromLeaf
      ? find(
        bookmarkGroups,
        d => (d.bookmarkIds || []).includes(fromId)
      )
      : find(
        bookmarkGroups,
        d => (d.bookmarkGroupIds || []).includes(fromId)
      )
  }
  let toGroup = null
  const toFirstLevel = toPoses.length === 2 && dropToGap
  if (!toFirstLevel) {
    toGroup = dropToGap
      ? find(
        bookmarkGroups,
        d => {
          const arr = toLeaf
            ? d.bookmarkIds
            : d.bookmarkGroupIds
          return (arr || []).includes(toId)
        }
      )
      : (
          toLeaf
            ? find(
              bookmarkGroups,
              d => (d.bookmarkIds || []).includes(toId)
            )
            : find(
              bookmarkGroups,
              d => d.id === toId
            )
        )
  }
  let nodeIndex = 0
  if (toGroup) {
    const pool = toLeaf
      ? toGroup.bookmarkIds || []
      : toGroup.bookmarkGroupIds || []
    nodeIndex = dropToGap
      ? pool.findIndex(d => d === toId)
      : pool.length
    if (dropToGap) {
      if (fromLeaf) {
        nodeIndex = dropPosition < last(toPoses)
          ? nodeIndex - 1
          : nodeIndex + 1
      } else {
        nodeIndex = dropPosition < last(toPoses)
          ? nodeIndex
          : nodeIndex + 1
      }
    }
  } else {
    nodeIndex = bookmarkGroups.findIndex(d => {
      return d.id === toId
    })
    if (fromLeaf) {
      nodeIndex = dropPosition < last(toPoses)
        ? nodeIndex - 1
        : nodeIndex + 1
    } else {
      nodeIndex = dropPosition < last(toPoses)
        ? nodeIndex
        : nodeIndex + 1
    }
  }
  if (nodeIndex < 0) {
    nodeIndex = 0
  }
  let fromIndex = 0
  if (!fromLeaf) {
    from.level = toFirstLevel ? 1 : 2
  }
  if (toFirstLevel) {
    fromIndex = bookmarkGroups.findIndex(d => d.id === fromId)
    from = copy(from)
    bookmarkGroups.splice(fromIndex, 1, 'tobedel')
    bookmarkGroups.splice(nodeIndex, 0, from)
    remove(bookmarkGroups, d => d === 'tobedel')
    if (fromGroup) {
      remove(fromGroup.bookmarkGroupIds, d => d === fromId)
    }
  } else if (fromGroup) {
    const arr = fromLeaf
      ? fromGroup.bookmarkIds
      : fromGroup.bookmarkGroupIds
    fromIndex = arr.findIndex(d => d === fromId)
    isSameCat
      ? arr.splice(fromIndex, 1, 'tobedel')
      : remove(arr, d => d === fromId)
  }
  if (!toFirstLevel) {
    const arr = !fromLeaf
      ? toGroup.bookmarkGroupIds
      : toGroup.bookmarkIds
    arr.splice(nodeIndex, 0, fromId)
    if (isSameCat) {
      remove(arr, d => d === 'tobedel')
    }
  }
})
