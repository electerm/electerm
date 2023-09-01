/**
 * find bookmark group id for bookmark id
 */

import {
  defaultBookmarkGroupId
} from './constants'
import { find } from 'lodash-es'

export default (bookmarkGroups, id) => {
  const obj = find(bookmarkGroups, bg => {
    return bg.bookmarkIds.includes(id)
  })
  return obj ? obj.id : defaultBookmarkGroupId
}
