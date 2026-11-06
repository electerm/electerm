// Use the same validation for the editor and for imported/synced bookmarks.
export function getBookmarkIconUrl (value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!/^https:\/\//i.test(trimmed)) return ''
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && !url.username && !url.password
      ? trimmed
      : ''
  } catch {
    return ''
  }
}
