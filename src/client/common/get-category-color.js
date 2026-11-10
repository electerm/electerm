/**
 * Defaults a new bookmark takes from the group it is filed under: the colour
 * (or a random one when the group has none) and the icon (or none).
 */

import { getRandomDefaultColor } from './rand-hex-color.js'
import { normalizeIcon } from './icon-value.js'

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

/**
 * The group's icon, inherited by a new bookmark. No icon is a valid answer:
 * it means "show the colour".
 * @param {Array} bookmarkGroups
 * @param {string} currentBookmarkGroupId
 */
export function getIconFromCategory (bookmarkGroups, currentBookmarkGroupId) {
  if (!currentBookmarkGroupId || !bookmarkGroups) {
    return ''
  }
  const currentGroup = bookmarkGroups.find(group => group.id === currentBookmarkGroupId)
  return normalizeIcon(currentGroup && currentGroup.icon)
}
