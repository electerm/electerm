/**
 * .vv connection file parser (virt-viewer / remote-viewer)
 *
 * A .vv file is an INI document with a mandatory [virt-viewer] group and a
 * mandatory `type` key. Everything SPICE-related lives directly in
 * [virt-viewer] -- there is NO [spice] group. An optional [ovirt] group
 * carries oVirt REST integration data.
 *
 * Behaviour is deliberately matched against:
 *   - src/virt-viewer-file.c  (gitlab.com/virt-viewer/virt-viewer)
 *   - src/virt-viewer-session-spice.c, for which port wins over tls-port
 *   - remote-viewer(1), "CONNECTION FILE" section
 *
 * Rejection rules copied from virt_viewer_file_new():
 *   no [virt-viewer] group  -> invalid file
 *   no `type` key           -> invalid file
 *   unknown keys/groups     -> kept, never an error (the format is
 *                              extensible; the convention is an `x-` prefix)
 *
 * This is the only copy. .vv loading happens in the renderer only, so there
 * is no src/app/common twin -- unlike sanitize-filename.js, which the main
 * process and the renderer both need.
 */

const MAIN_GROUP = 'virt-viewer'
const OVIRT_GROUP = 'ovirt'

/**
 * .vv key -> bookmark field understood by
 * src/client/components/bookmark-form/config/spice.js
 *
 * `port` and `tls-port` are NOT here: which one wins depends on whether the
 * other is present, so they are resolved in parseVv().
 */
const FIELD_MAP = {
  host: 'host',
  password: 'password',
  title: 'title',
  proxy: 'proxy',
  ca: 'ca',
  'host-subject': 'hostSubject'
}

/**
 * Keys parseVv() consumes itself, so the "not supported" pass must not report
 * them again.
 */
const HANDLED = new Set([
  'type',
  'delete-this-file',
  'port',
  'tls-port',
  ...Object.keys(FIELD_MAP)
])

/**
 * Keys the .vv format defines but electerm cannot honour for a spice session.
 * Each becomes a user-visible note instead of being dropped silently.
 */
const UNSUPPORTED = {
  'tls-ciphers': 'TLS is used, but the cipher list is not configurable',
  'unix-path': 'Unix-socket transport is not supported',
  username: 'spice sessions authenticate with the password only',
  'disable-channels': 'spice channel selection is not supported',
  'secure-channels': 'spice channel selection is not supported',
  'color-depth': 'colour depth is negotiated with the server',
  'disable-effects': 'remote desktop-effect control is not supported',
  'enable-smartcard': 'smartcard redirection is not supported',
  'enable-usbredir': 'USB redirection is not supported',
  'enable-usb-autoshare': 'USB redirection is not supported',
  'usb-filter': 'USB redirection is not supported',
  'usb-redirect-on-connect': 'USB redirection is not supported',
  fullscreen: 'fullscreen is a session-time toggle',
  version: 'client version requirements are not enforced',
  versions: 'client version requirements are not enforced',
  'newer-version-url': 'client version requirements are not enforced',
  'toggle-fullscreen': 'hotkey rebinding is not supported',
  'release-cursor': 'hotkey rebinding is not supported',
  'secure-attention': 'hotkey rebinding is not supported',
  'zoom-in': 'hotkey rebinding is not supported',
  'zoom-out': 'hotkey rebinding is not supported',
  'zoom-reset': 'hotkey rebinding is not supported',
  'smartcard-insert': 'hotkey rebinding is not supported',
  'smartcard-remove': 'hotkey rebinding is not supported',
  'usb-device-reset': 'hotkey rebinding is not supported'
}

/**
 * Proxmox writes the SPICE proxy ticket into `host` (see
 * PVE::AccessControl::remote_viewer_config) and puts the real node name inside
 * it. PVE::Ticket::verify_spice_connect_url() only accepts a ticket younger
 * than 40 seconds, so a .vv from the Proxmox UI is strictly single-use.
 */
const PROXMOX_TICKET = /^pvespiceproxy:/i

const BOOL_TRUE = new Set(['1', 'true', 'yes', 'on'])

function stripBom (text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function isComment (line) {
  return line.startsWith('#') || line.startsWith(';')
}

/**
 * GKeyFile escapes \\n, \\t, \\r, \\s and \\\\ inside values, and
 * g_key_file_get_string() expands them on read. parseIni keeps values
 * verbatim (a trailing space in a password is significant), so the one value
 * that is handed to a parser rather than used as-is is expanded here.
 *
 * Proxmox relies on this: it writes the whole CA on a single line with literal
 * "\\n" separators (`$cacert =~ s/\n/\\n/g`), which no PEM parser accepts
 * unexpanded.
 *
 * @param {string} value
 * @returns {string}
 */
function unescapeValue (value) {
  return value.replace(/\\(.)/g, (match, char) => {
    switch (char) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case 's': return ' '
      case '\\': return '\\'
      default: return match
    }
  })
}

/**
 * Read and range-check one of the two port keys.
 * @returns {number|null}
 */
function readPort (main, key, result) {
  if (!(key in main)) {
    return null
  }
  const raw = main[key].trim()
  const port = parseInt(raw, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    result.warnings.push('ignoring invalid ' + key + ' "' + raw + '"')
    return null
  }
  return port
}

/**
 * Parse INI text into { groupName: { key: value } }.
 *
 * GKeyFile itself is case-sensitive; group and key names are lowercased on
 * purpose, because hand-written .vv files are inconsistent about casing and
 * the alternative is a confusing "host not set" for a file that clearly
 * sets `Host=`.
 *
 * A trailing backslash continues the value on the next line (GKeyFile rule).
 *
 * @param {string} text
 * @returns {Object} groups
 */
function parseIni (text) {
  const groups = {}
  let group = null
  const lines = stripBom(text).split(/\r\n|\r|\n/)

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    while (/\\[ \t]*$/.test(line) && i + 1 < lines.length) {
      line = line.replace(/\\[ \t]*$/, '') + lines[++i]
    }

    const trimmed = line.trim()
    if (!trimmed || isComment(trimmed)) {
      continue
    }

    const groupMatch = trimmed.match(/^\[(.+)\]$/)
    if (groupMatch) {
      group = groupMatch[1].trim().toLowerCase()
      if (!groups[group]) {
        groups[group] = {}
      }
      continue
    }

    const eq = line.indexOf('=')
    if (eq < 0 || !group) {
      continue
    }

    const key = line.slice(0, eq).trim().toLowerCase()
    // Only leading whitespace is stripped. A trailing space is significant
    // for values such as passwords, so it is preserved.
    const value = line.slice(eq + 1).replace(/^[ \t]+/, '')
    if (key) {
      groups[group][key] = value
    }
  }

  return groups
}

/**
 * Parse the contents of a .vv file.
 *
 * @param {string} text - raw contents of a .vv file
 * @returns {{
 *   ok: boolean, error: string|null, type: string|null,
 *   fields: Object, applied: Array, ignored: Array,
 *   unknown: Array, warnings: string[], deleteThisFile: boolean,
 *   groups: Object
 * }}
 */
function parseVv (text) {
  const result = {
    ok: false,
    error: null,
    type: null,
    fields: {},
    applied: [],
    ignored: [],
    unknown: [],
    warnings: [],
    deleteThisFile: false,
    groups: {}
  }

  if (typeof text !== 'string' || !text.trim()) {
    result.error = 'empty file'
    return result
  }

  let groups
  try {
    groups = parseIni(text)
  } catch (e) {
    result.error = 'cannot parse file: ' + e.message
    return result
  }
  result.groups = groups

  const main = groups[MAIN_GROUP]
  if (!main) {
    result.error = 'invalid .vv file: missing [' + MAIN_GROUP + '] group'
    return result
  }

  const type = (main.type || '').trim().toLowerCase()
  if (!type) {
    result.error = 'invalid .vv file: missing "type" key in [' + MAIN_GROUP + ']'
    return result
  }
  result.type = type
  if (type !== 'spice') {
    result.error = 'unsupported session type "' + type + '": spice only'
    return result
  }

  // spice-gtk dials the plain port and only falls back to TLS when the file
  // offers no plain port at all (spice-channel.c: "trying with TLS port"), so
  // a file that sets both keeps its plain port here too.
  //
  // Which port key the file used also decides the transport, so `tls` is set
  // on both branches: the form only overwrites the keys it is handed, and a
  // switch left over from a previous file would silently break the connection.
  const plainPort = readPort(main, 'port', result)
  const tlsPort = readPort(main, 'tls-port', result)

  if (plainPort) {
    result.fields.port = plainPort
    result.fields.tls = false
    result.applied.push({ key: 'port', value: main.port, field: 'port' })
  } else if (tlsPort) {
    result.fields.port = tlsPort
    result.fields.tls = true
    result.applied.push({
      key: 'tls-port',
      value: main['tls-port'],
      field: 'port'
    })
  }

  Object.keys(FIELD_MAP).forEach(key => {
    if (!(key in main)) {
      return
    }
    const raw = main[key]
    const field = FIELD_MAP[key]

    if (key === 'password') {
      result.fields.password = raw
    } else {
      const value = raw.trim()
      if (!value) {
        result.warnings.push('ignoring empty "' + key + '"')
        return
      }
      result.fields[field] = key === 'ca' ? unescapeValue(value) : value
    }
    result.applied.push({ key, value: raw, field })
  })

  if (!result.fields.host) {
    result.error = 'no usable host: [virt-viewer] has no "host" key'
    return result
  }

  // The Proxmox ticket in `host` is signed and time limited: the proxy rejects
  // anything older than 40 seconds, so a saved bookmark can never work.
  if (PROXMOX_TICKET.test(result.fields.host)) {
    result.warnings.push(
      'this is a Proxmox SPICE proxy ticket: it is only valid for about 40 ' +
        'seconds, so connect right away -- saving it as a bookmark will not work'
    )
  }

  // delete-this-file=1 makes remote-viewer unlink the file after loading it
  // (unless VIRT_VIEWER_KEEP_FILE is set). We never delete the user's file;
  // surface it instead so the caller can decide.
  if ('delete-this-file' in main) {
    result.deleteThisFile = BOOL_TRUE.has(
      main['delete-this-file'].trim().toLowerCase()
    )
    if (result.deleteThisFile) {
      result.warnings.push(
        'the file is marked delete-this-file=1; it was NOT deleted'
      )
    }
  }

  Object.keys(main).forEach(key => {
    if (HANDLED.has(key)) {
      return
    }
    const value = main[key]
    if (key in UNSUPPORTED) {
      result.ignored.push({ key, value, reason: UNSUPPORTED[key] })
    } else {
      result.unknown.push({ key, value })
    }
  })

  // Both ports offered: the plain one wins (see above), but say so instead of
  // dropping the TLS port in silence.
  if (plainPort && tlsPort) {
    result.ignored.push({
      key: 'tls-port',
      value: main['tls-port'],
      reason:
        'this file also offers a plain port, which is the one remote-viewer uses'
    })
  }

  if (groups[OVIRT_GROUP]) {
    result.ignored.push({
      key: '[' + OVIRT_GROUP + ']',
      value: Object.keys(groups[OVIRT_GROUP]).join(', '),
      reason: 'oVirt REST integration is not supported'
    })
  }

  if (result.ignored.length) {
    result.warnings.push(
      result.ignored.length +
        ' option(s) in this file are not supported and were skipped'
    )
  }

  result.ok = true
  return result
}

/**
 * Turn a parse result into a one-line summary for a UI hint.
 *
 * @param {Object} parsed - result of parseVv
 * @returns {string}
 */
function describeVv (parsed) {
  if (!parsed || !parsed.ok) {
    return (parsed && parsed.error) || 'invalid .vv file'
  }
  const { host, port, title, proxy, tls } = parsed.fields
  const bits = ['spice' + (tls ? '+tls' : '') + '://' + host + (port ? ':' + port : '')]
  if (title) {
    bits.push('"' + title + '"')
  }
  if (proxy) {
    bits.push('via ' + proxy)
  }
  if (parsed.ignored.length) {
    bits.push(parsed.ignored.length + ' option(s) skipped')
  }
  return bits.join(' ')
}

export {
  parseVv,
  parseIni,
  describeVv,
  MAIN_GROUP,
  OVIRT_GROUP,
  FIELD_MAP,
  UNSUPPORTED
}
