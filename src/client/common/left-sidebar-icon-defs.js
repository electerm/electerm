/**
 * customizable icons for the far-left sidebar.
 *
 * `text` is a locale key passed to window.translate. The "about",
 * "hide sidebar" and "file transfer" icons are intentionally excluded —
 * they are always visible / conditionally rendered and not part of the
 * customizable set.
 *
 * `fallback` is the English wording used while `text` is still on its way
 * through the electerm-locales release (see common/tr.js); drop it once the key
 * is published.
 *
 * order of `leftSidebarIconOptions` is the default order shown in the sidebar.
 */
export const leftSidebarIconOptions = [
  { id: 'newBookmark', text: 'newBookmark' },
  { id: 'quickConnect', text: 'quickConnect' },
  { id: 'bookmarks', text: 'bookmarks' },
  // the bookmark tree and the bookmark bar are two views of the same data, so
  // they sit next to each other here too
  { id: 'bookmarkBar', text: 'bookmarkBar', fallback: 'bookmark bar' },
  { id: 'terminalThemes', text: 'terminalThemes' },
  { id: 'setting', text: 'setting' },
  { id: 'settingSync', text: 'settingSync' },
  { id: 'widgets', text: 'widgets' }
]

// default ordered list of icon ids — mirrors the order above
export const defaultLeftSideBarIcons = leftSidebarIconOptions.map(o => o.id)

// valid ids, for sanitizing persisted/synced config
export const leftSidebarIconIds = new Set(leftSidebarIconOptions.map(o => o.id))

/**
 * returns a clean, ordered list of icon ids from a possibly-untrusted value:
 * unknown ids dropped, missing default ids left to the user's choice.
 */
export function normalizeLeftSideBarIcons (value) {
  if (!Array.isArray(value)) {
    return [...defaultLeftSideBarIcons]
  }
  return value.filter(id => leftSidebarIconIds.has(id))
}
