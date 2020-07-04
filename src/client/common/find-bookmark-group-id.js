/**
 * find bookmark group id for bookmark id
 */

import {
  defaultBookmarkGroupId
} from './constants'
import _ from 'lodash'

export default (bookmarkGroups, id) => {
  const obj = _.find(bookmarkGroups, bg => {
    return bg.bookmarkIds.includes(id)
  })
  return obj ? obj.id : defaultBookmarkGroupId
}
