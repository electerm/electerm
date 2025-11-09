/**
 * Get default color from current category or random color
 */

import { getRandomDefaultColor } from './rand-hex-color.js'

export function getColorFromCategory (bookmarkGroups, currentBookmarkGroupId) {
  if (!currentBookmarkGroupId || !bookmarkGroups) {
    return getRandomDefaultColor()
  }

  const currentGroup = bookmarkGroups.find(group => group.id === currentBookmarkGroupId)

  if (currentGroup && currentGroup.color) {
    return currentGroup.color
  }

  return getRandomDefaultColor()
}
