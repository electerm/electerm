/**
 * find bookmark group id for bookmark id
 */

import {
  defaultBookmarkGroupId
} from './constants'

export default (bookmarkGroups, id) => {
  const obj = bookmarkGroups.find(bg => {
    return bg.bookmarkIds.includes(id)
  })
  return obj ? obj.id : defaultBookmarkGroupId
}
