/**
 * Bookmark import file shapes
 *
 * Three shapes are accepted, because each one is something a user actually ends
 * up with:
 *   - a bare bookmark array, which is what the bookmarks export writes
 *   - `{ bookmarks, bookmarkGroups }`, the shape the full data export embeds
 *   - a single bookmark object, e.g. one entry copied out of an export
 *
 * The single object case matters: it used to fall into the wrapper branch, find
 * no `bookmarks` array and import nothing at all, without telling the user. An
 * unrecognized object now raises instead of silently importing nothing.
 */

function isPlainObject (value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

// a bookmark points at something to connect to (ssh/telnet host, serial path,
// web url); a container object does not
function isBookmark (obj) {
  return 'host' in obj || 'path' in obj || 'url' in obj
}

function unsupported () {
  return new Error(
    'Unsupported bookmarks file: expected a bookmark array, ' +
    'a { bookmarks, bookmarkGroups } object, or a single bookmark object'
  )
}

/**
 * Normalize an imported bookmarks file to `{ bookmarks, bookmarkGroups }`.
 *
 * Categories are only ever taken from the file; bookmarks the file leaves
 * uncategorized are collected into `uncategory-bookmarks-<stamp>` by
 * collectUncategorizedBookmarks() once they are in the store.
 *
 * @param {*} content parsed JSON of the imported file
 * @returns {{bookmarks: Array, bookmarkGroups: Array}}
 */
export default function parseBookmarkImport (content) {
  if (Array.isArray(content)) {
    return { bookmarks: content, bookmarkGroups: [] }
  }
  if (!isPlainObject(content)) {
    throw unsupported()
  }
  if (Array.isArray(content.bookmarks)) {
    return {
      bookmarks: content.bookmarks,
      bookmarkGroups: Array.isArray(content.bookmarkGroups)
        ? content.bookmarkGroups
        : []
    }
  }
  if (isBookmark(content)) {
    return { bookmarks: [content], bookmarkGroups: [] }
  }
  throw unsupported()
}
