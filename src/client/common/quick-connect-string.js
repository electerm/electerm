/**
 * Quick Connect String Serializer
 *
 * The inverse of ./parse-quick-connect.js: turn a bookmark (session config)
 * into the string form the quick connect box and the electerm:// deep link
 * accept, so the two stay round-trippable.
 *
 *   protocol://[username[:password]@]host[:port]?opts={...}
 *
 * Anything the URL cannot carry (title, tunnels, hopping, terminal settings)
 * goes into `opts`. Fields that would reach spawn() or a shell never do - they
 * are in DANGEROUS_SESSION_FIELDS and parseQuickConnect() drops them anyway.
 *
 * Known limit, inherited from the parser: username/password are not
 * percent-encoded, so a credential containing '@' or ':' will not round-trip.
 */
import DANGEROUS_SESSION_FIELDS from './dangerous-session-fields'
import { DEFAULT_PORTS, TYPE_DEFAULT_VALUES } from './parse-quick-connect'

// the protocols a bookmark type can actually be expressed as
const STRINGIFY_PROTOCOLS = ['ssh', 'telnet', 'vnc', 'rdp', 'spice', 'serial', 'ftp']

// carried by the URL itself, internal to the config, or not connection data
const SKIP_FIELDS = [
  'id',
  'category',
  'color',
  'type',
  'host',
  'port',
  'username',
  'user',
  'password',
  'url',
  'path',
  'baudRate',
  'terminalBackground',
  ...DANGEROUS_SESSION_FIELDS
]

const isBlank = v =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && !v.length) ||
  (typeof v === 'object' && !Object.keys(v).length)

/**
 * The fields worth carrying in `opts`: everything the URL does not already
 * hold, minus the values parseQuickConnect() restores on its own (its per-type
 * defaults) and minus the empty ones a form leaves behind. A bookmark that is
 * all defaults serializes to just the URL.
 */
function buildOpts (bookmark, type) {
  const defaults = TYPE_DEFAULT_VALUES[type] || {}
  const opts = {}
  Object.keys(bookmark).forEach(key => {
    if (SKIP_FIELDS.includes(key)) {
      return
    }
    const value = bookmark[key]
    if (isBlank(value)) {
      return
    }
    if (
      key in defaults &&
      JSON.stringify(defaults[key]) === JSON.stringify(value)
    ) {
      return
    }
    opts[key] = value
  })
  return Object.keys(opts).length ? opts : null
}

function appendOpts (str, bookmark, type) {
  const opts = buildOpts(bookmark, type)
  return opts
    ? str + (str.includes('?') ? '&' : '?') + 'opts=' + JSON.stringify(opts)
    : str
}

/**
 * Serialize a bookmark into a quick connect string
 * @param {object} bookmark - bookmark / session config
 * @returns {string} quick connect string, '' when the type has no string form
 */
export function stringifyQuickConnect (bookmark = {}) {
  const {
    type = 'ssh',
    host,
    port,
    username,
    user,
    password,
    url,
    path
  } = bookmark

  // web: the url already is the whole address, only the extras need carrying
  if (type === 'web') {
    return url ? appendOpts(url, bookmark, type) : ''
  }

  if (!STRINGIFY_PROTOCOLS.includes(type)) {
    return ''
  }

  if (type === 'serial') {
    if (!path) {
      return ''
    }
    const baudRate = isBlank(bookmark.baudRate) ? '' : `:${bookmark.baudRate}`
    return appendOpts(`serial://${path}${baudRate}`, bookmark, type)
  }

  if (!host) {
    return ''
  }

  const name = username || user
  const auth = name
    ? name + (isBlank(password) ? '' : `:${password}`) + '@'
    : ''

  // a default port is restored by the parser, so leave it out
  const portStr = !isBlank(port) && Number(port) !== DEFAULT_PORTS[type]
    ? `:${port}`
    : ''

  return appendOpts(`${type}://${auth}${host}${portStr}`, bookmark, type)
}

export default stringifyQuickConnect
