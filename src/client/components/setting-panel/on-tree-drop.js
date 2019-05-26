/**
 * handle tree on drop event to support category drag/drop in any form
 */

import {
  defaultookmarkGroupId
} from '../../common/constants'
import _ from 'lodash'
import copy from 'json-deep-copy'

export default (info, props) => {
  let {
    dropToGap,
    dragNode,
    node,
    dropPosition
  } = info
  let fromId = dragNode.props.eventKey
  let toId = node.props.eventKey
  let fromLeaf = dragNode.props.isLeaf
  let toLeaf = node.isLeaf()
  let fromPoses = dragNode.props.pos.split('-').map(Number)
  let fromPosesLevel = fromPoses.slice(0, fromPoses.length - 1)
  let toPoses = node.props.pos.split('-').map(Number)
  let toPosesLevel = toPoses.slice(0, toPoses.length - 1)
  let isSameLevel = fromPosesLevel.length === toPosesLevel.length
  let isSameCat = _.isEqual(fromPosesLevel, toPosesLevel) && dropToGap
  let bookmarks = copy(props.bookmarks)
  let bookmarkGroups = copy(
    props.bookmarkGroups
  )
  let from = fromLeaf
    ? _.find(
      bookmarks,
      d => d.id === fromId
    )
    : _.find(
      bookmarkGroups,
      d => d.id === fromId
    )
  let to = toLeaf
    ? _.find(
      bookmarks,
      d => d.id === toId
    )
    : _.find(
      bookmarkGroups,
      d => d.id === toId
    )

  // no match
  if (!to || !from) {
    return
  }

  // drop to a leaf
  if (toLeaf && !dropToGap) {
    return
  }

  // drag default cateogry to other level
  if (fromId === defaultookmarkGroupId && !isSameLevel) {
    return
  }

  // drag default cateogry to nongap
  if (fromId === defaultookmarkGroupId && !dropToGap) {
    console.log('return', 'drag default cateogry to nongap')
    return
  }

  // drag cateogry with subscategory to non gap
  if (!fromLeaf && !dropToGap && from.bookmarkGroupIds && from.bookmarkGroupIds.length) {
    return
  }

  // drag cat to level2 node
  if (!fromLeaf && toPoses.length > 2 && !dropToGap) {
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
      ? _.find(
        bookmarkGroups,
        d => (d.bookmarkIds || []).includes(fromId)
      )
      : _.find(
        bookmarkGroups,
        d => (d.bookmarkGroupIds || []).includes(fromId)
      )
  }
  let toGroup = null
  let toFirstLevel = toPoses.length === 2 && dropToGap
  if (!toFirstLevel) {
    toGroup = dropToGap
      ? _.find(
        bookmarkGroups,
        d => {
          let arr = toLeaf
            ? d.bookmarkIds
            : d.bookmarkGroupIds
          return (arr || []).includes(toId)
        }
      )
      : _.find(
        bookmarkGroups,
        d => d.id === toId
      )
  }
  let nodeIndex = 0
  if (toGroup) {
    let pool = toLeaf
      ? toGroup.bookmarkIds || []
      : toGroup.bookmarkGroupIds || []
    nodeIndex = dropToGap
      ? _.findIndex(pool, d => d === toId)
      : pool.length
    if (dropToGap) {
      if (fromLeaf) {
        nodeIndex = dropPosition < _.last(toPoses)
          ? nodeIndex - 1
          : nodeIndex + 1
      } else {
        nodeIndex = dropPosition < _.last(toPoses)
          ? nodeIndex
          : nodeIndex + 1
      }
    }
  } else {
    nodeIndex = _.findIndex(bookmarkGroups, d => {
      return d.id === toId
    })
    if (fromLeaf) {
      nodeIndex = dropPosition < _.last(toPoses)
        ? nodeIndex - 1
        : nodeIndex + 1
    } else {
      nodeIndex = dropPosition < _.last(toPoses)
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
    fromIndex = _.findIndex(bookmarkGroups, d => d.id === fromId)
    from = copy(from)
    bookmarkGroups.splice(fromIndex, 1, 'tobedel')
    bookmarkGroups.splice(nodeIndex, 0, from)
    _.remove(bookmarkGroups, d => d === 'tobedel')
    if (fromGroup) {
      _.remove(fromGroup.bookmarkGroupIds, d => d === fromId)
    }
  } else if (fromGroup) {
    let arr = fromLeaf
      ? fromGroup.bookmarkIds
      : fromGroup.bookmarkGroupIds
    fromIndex = _.findIndex(arr, d => d === fromId)
    isSameCat
      ? arr.splice(fromIndex, 1, 'tobedel')
      : _.remove(arr, d => d === fromId)
  }
  if (!toFirstLevel) {
    let arr = !fromLeaf
      ? toGroup.bookmarkGroupIds
      : toGroup.bookmarkIds
    arr.splice(nodeIndex, 0, fromId)
    if (isSameCat) {
      _.remove(arr, d => d === 'tobedel')
    }
  }
  props.store.modifier({
    bookmarkGroups
  })
}
