/**
 * Bookmark export filter
 *
 * The AI agent never reads bookmark field values: it only hands over a filter
 * object ("ssh bookmarks that have a private key"), and this module turns that
 * into a list of bookmark ids. The ids are then rendered as a panel in the app,
 * and the user decides whether to write the file. Everything the agent sees is a
 * count per type -- no host, no username, and certainly no credential.
 *
 * Dependency-free on purpose: it is loaded directly by the unit tests in
 * src/test/unit-ci (see the note in bookmark-uncategorized.js).
 */

// bookmark types that can appear in the filter. Kept in sync with
// components/bookmark-form/bookmark-schema.js by hand -- the schemas there carry
// descriptions for the AI prompt, this list only names the types.
export const bookmarkExportTypes = [
  'ssh',
  'telnet',
  'serial',
  'vnc',
  'rdp',
  'ftp',
  'web',
  'local',
  'spice'
]

// default ports, so "port: 22" also matches an ssh bookmark that left the port
// empty instead of surprising the user with an empty result
const defaultPorts = {
  ssh: 22,
  telnet: 23,
  ftp: 21,
  vnc: 5900,
  spice: 5900,
  rdp: 3389
}

function text (value) {
  return typeof value === 'string' ? value.trim() : ''
}

// "the field carries something" -- an empty string and an empty array do not
function filled (value) {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'string') {
    return value.trim() !== ''
  }
  return value !== undefined && value !== null
}

function flagOrNull (value) {
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }
  return null
}

function includesText (haystack, needle) {
  return text(haystack).toLowerCase().includes(needle.toLowerCase())
}

/**
 * Type of a bookmark.
 *
 * Old bookmarks carry no `type` at all: anything with a host is an SSH
 * connection, a `path` is a serial port, a `url` is a web page, and the rest is
 * a local terminal. Same rule terminal.jsx uses when it picks a renderer.
 */
export function getBookmarkType (bookmark) {
  if (!bookmark) {
    return ''
  }
  const type = text(bookmark.type).toLowerCase()
  if (type) {
    return type
  }
  if (text(bookmark.host)) {
    return 'ssh'
  }
  if (text(bookmark.path)) {
    return 'serial'
  }
  if (text(bookmark.url)) {
    return 'web'
  }
  return 'local'
}

/**
 * Port the bookmark actually connects to, default filled in.
 * @returns {number|null} null when the type has no port
 */
export function getBookmarkPort (bookmark) {
  const port = Number(bookmark && bookmark.port)
  if (Number.isFinite(port) && port > 0) {
    return port
  }
  return defaultPorts[getBookmarkType(bookmark)] || null
}

/**
 * Normalize whatever the agent sent into the shape the matcher expects.
 * Unknown keys are dropped, `type` and `types` are merged, and 'any'/'all'
 * (which models like to send) means "no type constraint".
 */
export function normalizeBookmarkExportFilter (filter) {
  const raw = filter && typeof filter === 'object' ? filter : {}
  const types = []
  const addType = value => {
    const type = text(value).toLowerCase()
    if (type && type !== 'any' && type !== 'all' && !types.includes(type)) {
      types.push(type)
    }
  }
  if (Array.isArray(raw.types)) {
    raw.types.forEach(addType)
  } else if (typeof raw.types === 'string') {
    raw.types.split(',').forEach(addType)
  }
  addType(raw.type)

  const port = Number(raw.port)
  const ids = Array.isArray(raw.ids)
    ? raw.ids.map(id => text(id)).filter(Boolean)
    : []

  return {
    types,
    ids,
    keyword: text(raw.keyword),
    host: text(raw.host),
    username: text(raw.username),
    group: text(raw.group),
    authType: text(raw.authType).toLowerCase(),
    port: Number.isFinite(port) && port > 0 ? port : null,
    hasPrivateKey: flagOrNull(raw.hasPrivateKey),
    hasPassword: flagOrNull(raw.hasPassword),
    hasCertificate: flagOrNull(raw.hasCertificate),
    hasProxy: flagOrNull(raw.hasProxy),
    hasSshTunnels: flagOrNull(raw.hasSshTunnels),
    hasConnectionHoppings: flagOrNull(raw.hasConnectionHoppings),
    hasQuickCommands: flagOrNull(raw.hasQuickCommands)
  }
}

// boolean field filters, each one reads the same "does it carry this" rule
const flagFields = {
  hasPrivateKey: b => filled(b.privateKey) || filled(b.privateKeyPath),
  hasPassword: b => filled(b.password),
  hasCertificate: b => filled(b.certificate) || filled(b.certificatePath),
  hasProxy: b => filled(b.proxy),
  hasSshTunnels: b => filled(b.sshTunnels),
  hasConnectionHoppings: b => filled(b.connectionHoppings),
  hasQuickCommands: b => filled(b.quickCommands)
}

function matches (bookmark, filter, groups) {
  if (filter.ids.length && !filter.ids.includes(bookmark.id)) {
    return false
  }
  if (filter.types.length && !filter.types.includes(getBookmarkType(bookmark))) {
    return false
  }
  if (filter.keyword) {
    const haystack = [
      bookmark.title,
      bookmark.host,
      bookmark.username,
      bookmark.user,
      bookmark.url,
      bookmark.path,
      bookmark.description
    ].filter(Boolean).join(' ')
    if (!includesText(haystack, filter.keyword)) {
      return false
    }
  }
  if (filter.host && !includesText(bookmark.host, filter.host)) {
    return false
  }
  if (filter.port && getBookmarkPort(bookmark) !== filter.port) {
    return false
  }
  if (filter.username && !includesText(bookmark.username || bookmark.user, filter.username)) {
    return false
  }
  if (filter.group) {
    const wanted = filter.group.toLowerCase()
    const owned = groups.some(group =>
      group.id === filter.group || includesText(group.title, wanted)
    )
    if (!owned) {
      return false
    }
  }
  if (filter.authType && text(bookmark.authType).toLowerCase() !== filter.authType) {
    return false
  }
  for (const [key, read] of Object.entries(flagFields)) {
    if (filter[key] !== null && read(bookmark) !== filter[key]) {
      return false
    }
  }
  return true
}

/**
 * Bookmarks matching a filter, in store order.
 *
 * @param {Array} bookmarks bookmarks from the store
 * @param {Array} bookmarkGroups categories from the store, for `group`
 * @param {Object} rawFilter filter as the agent sent it (or any object shape)
 * @returns {{ids: string[], byType: Object, total: number, filter: Object}}
 */
export function filterBookmarksForExport (bookmarks = [], bookmarkGroups = [], rawFilter) {
  const filter = normalizeBookmarkExportFilter(rawFilter)
  const groupsByBookmark = new Map()
  for (const group of bookmarkGroups || []) {
    for (const id of group.bookmarkIds || []) {
      const owned = groupsByBookmark.get(id)
      if (owned) {
        owned.push(group)
      } else {
        groupsByBookmark.set(id, [group])
      }
    }
  }

  const ids = []
  const byType = {}
  for (const bookmark of bookmarks || []) {
    if (!bookmark || !bookmark.id) {
      continue
    }
    if (!matches(bookmark, filter, groupsByBookmark.get(bookmark.id) || [])) {
      continue
    }
    ids.push(bookmark.id)
    const type = getBookmarkType(bookmark)
    byType[type] = (byType[type] || 0) + 1
  }
  return { ids, byType, total: ids.length, filter }
}

/**
 * One-line, human readable description of a filter. Shown in the export panel
 * so the user can see what the agent asked for, and returned to the agent in
 * place of the raw object.
 */
export function describeBookmarkExportFilter (filter) {
  const f = normalizeBookmarkExportFilter(filter)
  const parts = [f.types.length ? f.types.join('/') : 'any type']
  if (f.keyword) {
    parts.push(`keyword "${f.keyword}"`)
  }
  if (f.host) {
    parts.push(`host ~ "${f.host}"`)
  }
  if (f.port) {
    parts.push(`port ${f.port}`)
  }
  if (f.username) {
    parts.push(`username ~ "${f.username}"`)
  }
  if (f.group) {
    parts.push(`group "${f.group}"`)
  }
  if (f.authType) {
    parts.push(`auth ${f.authType}`)
  }
  for (const [key, label] of Object.entries({
    hasPrivateKey: 'private key',
    hasPassword: 'password',
    hasCertificate: 'certificate',
    hasProxy: 'proxy',
    hasSshTunnels: 'ssh tunnels',
    hasConnectionHoppings: 'connection hopping',
    hasQuickCommands: 'quick commands'
  })) {
    if (f[key] === true) {
      parts.push(`with ${label}`)
    } else if (f[key] === false) {
      parts.push(`without ${label}`)
    }
  }
  if (f.ids.length) {
    parts.push(`${f.ids.length} picked by id`)
  }
  return parts.join(', ')
}

/**
 * The file contents: the selected bookmarks, plus the categories that hold
 * them (ancestors included, so the tree still nests on import).
 *
 * This is the only place credentials leave the store, and it only ever goes to
 * the file the user asked for -- never to the agent.
 *
 * @returns {{bookmarks: Array, bookmarkGroups: Array}}
 */
export function buildBookmarkExportPayload (bookmarks = [], bookmarkGroups = [], ids = []) {
  const selected = new Set(ids)
  const groups = bookmarkGroups || []
  const keep = new Set()

  const keepGroup = group => {
    if (!group || keep.has(group.id)) {
      return
    }
    keep.add(group.id)
    for (const parent of groups) {
      if ((parent.bookmarkGroupIds || []).includes(group.id)) {
        keepGroup(parent)
      }
    }
  }
  for (const group of groups) {
    if ((group.bookmarkIds || []).some(id => selected.has(id))) {
      keepGroup(group)
    }
  }

  return {
    bookmarks: (bookmarks || []).filter(b => b && selected.has(b.id)),
    bookmarkGroups: groups
      .filter(group => keep.has(group.id))
      .map(group => ({
        ...group,
        bookmarkIds: (group.bookmarkIds || []).filter(id => selected.has(id)),
        bookmarkGroupIds: (group.bookmarkGroupIds || []).filter(id => keep.has(id))
      }))
  }
}
