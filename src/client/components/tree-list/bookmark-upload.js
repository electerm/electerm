/**
 * bookmark import/upload logic
 */

import copy from 'json-deep-copy'
import { uniq, isPlainObject } from 'lodash-es'
import { action } from 'manate'
import uid from '../../common/uid'
import { fixBookmarks } from '../../common/db-fix'
import { runImportTask } from '../../common/import-task'
import { collectUncategorizedBookmarks } from '../../common/bookmark-uncategorized'
import parseBookmarkImport from '../../common/parse-bookmark-import'

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

  // a bare array (the bookmarks export), a `{ bookmarks, bookmarkGroups }`
  // object (the full data export), or a single bookmark object; only the
  // wrapper carries categories, and the sweep at the end of the import puts
  // every category-less bookmark in `uncategory-bookmarks-<stamp>`
  let parsed
  try {
    const txt = file.fileContent !== undefined
      ? file.fileContent
      : await window.fs.readFile(file.filePath)
    parsed = parseBookmarkImport(JSON.parse(txt))
  } catch (err) {
    // a file that is not bookmarks at all used to import nothing and say
    // nothing; report it instead of leaving the user wondering
    store.onError(err)
    return false
  }
  const bookmarkGroups1 = parsed.bookmarkGroups
  const bookmarks1 = fixBookmarksId(parsed.bookmarks)

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
          // bookmarks the file left uncategorized (all of them, for a bare
          // array) would be invisible in the sidebar: the tree is built from
          // the category references, so they need a category of their own
          action(() => {
            collectUncategorizedBookmarks(store.bookmarks, store.bookmarkGroups)
            store.fixBookmarkGroups()
          })()
        }
      }
    ]
  })

  return false
})

export async function beforeBookmarkUpload (file) {
  return bookmarkUpload(file)
}
