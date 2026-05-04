/**
 * bookmark import/upload logic
 */

import copy from 'json-deep-copy'
import { uniq, isPlainObject } from 'lodash-es'
import { action } from 'manate'
import uid from '../../common/uid'
import time from '../../common/time'
import { fixBookmarks } from '../../common/db-fix'
import delay from '../../common/wait'

function fixBookmarksId (bookmarks) {
  return bookmarks.map(item => {
    if (!isPlainObject(item)) {
      return null
    }
    if (!item.id) {
      item.id = uid()
    }
    return item
  }).filter(Boolean)
}
export const bookmarkUpload = action(async (file) => {
  const { store } = window
  const { bookmarks, bookmarkGroups } = store

  const filePath = file.filePath
  const txt = await window.fs.readFile(filePath)

  const content = JSON.parse(txt)
  let bookmarkGroups1 = []
  let bookmarks1 = []
  if (Array.isArray(content)) {
    bookmarks1 = fixBookmarksId(content)
    bookmarkGroups1 = [{
      id: uid(),
      title: 'imported_' + time(),
      color: '#0088cc',
      bookmarkGroupIds: [],
      bookmarkIds: bookmarks1.map(b => b.id)
    }]
  } else {
    bookmarkGroups1 = content.bookmarkGroups || []
    bookmarks1 = fixBookmarksId(content.bookmarks || [])
  }

  const bookmarkGroups0 = copy(bookmarkGroups)
  const bookmarks0 = copy(bookmarks)

  const bmTree = new Map(
    bookmarks0.map(bookmark => [bookmark.id, bookmark])
  )
  const bmgTree = new Map(
    bookmarkGroups0.map(group => [group.id, group])
  )

  const fixed = fixBookmarks(bookmarks1)

  fixed.forEach(bg => {
    if (!bmTree.has(bg.id)) {
      store.bookmarks.push(bg)
    }
  })

  bookmarkGroups1.forEach(bg => {
    if (!bmgTree.has(bg.id)) {
      store.bookmarkGroups.push(bg)
    } else {
      const bg1 = store.bookmarkGroups.find(
        b => b.id === bg.id
      )
      bg1.bookmarkIds = uniq(
        [
          ...(bg1.bookmarkIds || []),
          ...(bg.bookmarkIds || [])
        ]
      )
      bg1.bookmarkGroupIds = uniq(
        [
          ...(bg1.bookmarkGroupIds || []),
          ...(bg.bookmarkGroupIds || [])
        ]
      )
    }
  })

  store.fixBookmarkGroups()

  return false
})

export async function beforeBookmarkUpload (file) {
  const names = [
    'bookmarks',
    'bookmarkGroups'
  ]
  for (const name of names) {
    window[`watch${name}`].stop()
  }
  bookmarkUpload(file)
  await delay(1000)
  for (const name of names) {
    window[`watch${name}`].start()
  }
}
