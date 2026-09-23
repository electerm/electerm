/**
 * bookmark import/upload logic
 */

import copy from 'json-deep-copy'
import { uniq, isPlainObject } from 'lodash-es'
import { action } from 'manate'
import uid from '../../common/uid'
import time from '../../common/time'
import { fixBookmarks } from '../../common/db-fix'
import { runImportTask } from '../../common/import-task'

const e = window.translate

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

  const txt = file.fileContent !== undefined
    ? file.fileContent
    : await window.fs.readFile(file.filePath)

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

  await runImportTask({
    title: e('import'),
    batch: 200,
    stopWatchers: ['bookmarks', 'bookmarkGroups'],
    steps: [
      {
        label: e('bookmarks'),
        items: fixed,
        process: (chunk) => {
          chunk.forEach(bg => {
            if (!bmTree.has(bg.id)) {
              store.bookmarks.push(bg)
            }
          })
        }
      },
      {
        label: e('bookmarkCategory'),
        items: bookmarkGroups1,
        process: (chunk) => {
          chunk.forEach(bg => {
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
        }
      },
      {
        label: e('bookmarks'),
        weight: 1,
        run: () => {
          store.fixBookmarkGroups()
        }
      }
    ]
  })

  return false
})

export async function beforeBookmarkUpload (file) {
  return bookmarkUpload(file)
}
