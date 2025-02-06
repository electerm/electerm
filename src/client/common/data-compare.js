/**
 * Compare two arrays of objects and return differences
 * @param {Array} oldArr - Original array of objects
 * @param {Array} newArr - New array of objects to compare against
 * @returns {Object} Object containing arrays of items to update, add, and remove
 */

import deepCopy from 'json-deep-copy'

export default function compare (oldArr, newArr) {
  if (!oldArr || !newArr) {
    return {
      updated: [],
      added: [],
      removed: []
    }
  }
  // Create maps for faster lookup
  const oldMap = new Map(
    oldArr.map(item => [item.id, item])
  )
  const newMap = new Map(
    newArr.map(item => [item.id, item])
  )

  const updated = []
  const added = []
  const removed = []

  // Find items to update or add
  for (const item of newArr) {
    const oldItem = oldMap.get(item.id)
    if (!oldItem) {
      // Item doesn't exist in old array - need to add
      added.push(item)
    } else {
      // Item exists - check if it needs updating
      // Convert to JSON strings for deep comparison
      const oldStr = JSON.stringify(oldItem)
      const newStr = JSON.stringify(item)
      if (oldStr !== newStr) {
        updated.push(item)
      }
    }
  }

  // Find items to remove
  for (const item of oldArr) {
    if (!newMap.has(item.id)) {
      removed.push(item)
    }
  }
  return {
    updated: deepCopy(updated),
    added: deepCopy(added),
    removed: deepCopy(removed)
  }
}
