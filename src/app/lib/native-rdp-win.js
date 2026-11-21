/**
 * Launch an RDP bookmark with the local Windows RDP client (mstsc.exe).
 *
 * The built-in RDP client is IronRDP running in the renderer (see
 * src/app/server/session-rdp.js and src/client/components/rdp/). It does not do
 * drive redirection, audio, multi monitor or USB redirection -- the limitations
 * listed at https://github.com/electerm/electerm/wiki/RDP-limitation. Users who
 * need those (and Windows 7 users in general, since mstsc ships with the system)
 * get the same bookmark opened in the local client instead.
 *
 * Windows only, and only on the desktop app: `window.pre.isWin` in the web app
 * is the platform of the machine running the server, not of the browser that
 * would have to start mstsc.
 *
 * Requires nothing but Node builtins, which is what lets the unit test in
 * src/test/unit-ci/native-rdp-win.spec.js run without installing anything.
 */

const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_PORT = 3389
const MSTSC = 'mstsc.exe'
// mstsc may read the file after the launcher process is gone, so this is a
// generous timer rather than an exit hook
const TEMP_FILE_TTL = 60 * 1000

function isSupported () {
  return process.platform === 'win32'
}

/**
 * `.rdp` is a line based `key:type:value` file: a value carrying a line break
 * would append settings of its own, so such values are rejected, not escaped.
 * @param {*} value
 * @param {string} name
 * @returns {string}
 */
function singleLine (value, name) {
  const str = value === undefined || value === null ? '' : String(value).trim()
  if (/[\r\n]/.test(str)) {
    throw new Error(`${name} must not contain a line break`)
  }
  return str
}

function normalizeHost (host) {
  const str = singleLine(host, 'host')
  if (!str) {
    throw new Error('host is required')
  }
  if (/\s/.test(str)) {
    throw new Error('host must not contain whitespace')
  }
  return str
}

function normalizePort (port) {
  const num = Number(port) || DEFAULT_PORT
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new Error(`invalid RDP port: ${port}`)
  }
  return num
}

/**
 * @param {object} options
 * @param {string} options.host
 * @param {number} [options.port]
 * @param {string} [options.username]
 * @param {string} [options.domain]
 * @param {boolean} [options.nla] the bookmark's own NLA choice
 * @returns {string} `.rdp` file content, CRLF separated
 */
function buildRdpFileContent (options = {}) {
  const host = normalizeHost(options.host)
  const port = normalizePort(options.port)
  const username = singleLine(options.username, 'username')
  const domain = singleLine(options.domain, 'domain')
  const lines = [
    `full address:s:${host}:${port}`,
    // the bookmark decides, exactly like the built-in client (see config/rdp.js)
    `enablecredsspsupport:i:${options.nla === false ? 0 : 1}`,
    // 2 = warn but still connect when the server identity cannot be verified:
    // what mstsc writes itself, and what self-signed hosts need
    'authentication level:i:2',
    // the one capability both clients share, so keep it on
    'redirectclipboard:i:1'
  ]
  if (username) {
    lines.push(`username:s:${username}`)
  }
  if (domain && username && !/[\\@]/.test(username)) {
    lines.push(`domain:s:${domain}`)
  }
  return lines.join('\r\n')
}

/**
 * %SystemRoot%\System32\<exe>, falling back to the bare name so a PATH-resolved
 * binary still works. 32-bit builds on 64-bit Windows resolve System32 to
 * SysWOW64, which carries both binaries as well.
 * @param {string} name
 * @returns {string}
 */
function systemExe (name) {
  const root = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  const full = path.join(root, 'System32', name)
  try {
    fs.accessSync(full)
    return full
  } catch (e) {
    return name
  }
}

function spawnDetached (command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    })
    // stays attached after settling, so a late error is swallowed instead of
    // crashing the main process
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function removeLater (file) {
  const timer = setTimeout(() => {
    fs.unlink(file, () => {})
  }, TEMP_FILE_TTL)
  // a temp file must never keep the app alive
  if (timer.unref) {
    timer.unref()
  }
  return timer
}

/**
 * Start mstsc and let Windows handle sign-in.
 * @param {object} options see buildRdpFileContent
 * @returns {Promise<{file: string}>}
 */
async function launchNativeRdp (options = {}) {
  if (!isSupported()) {
    throw new Error('opening the local RDP client is only supported on Windows')
  }
  const content = buildRdpFileContent(options)
  const file = path.join(
    os.tmpdir(),
    `electerm-rdp-${process.pid}-${Date.now()}.rdp`
  )
  // UTF-16LE with BOM: what mstsc writes itself, and the encoding that keeps
  // non-ASCII user names and domains readable (a UTF-8 file is not)
  fs.writeFileSync(file, Buffer.from('\ufeff' + content, 'utf16le'))
  try {
    await spawnDetached(systemExe(MSTSC), [file])
  } catch (err) {
    // synchronous on purpose: the failed launch is about to be reported, and a
    // caller checking for leftovers right after must not race the unlink
    try {
      fs.unlinkSync(file)
    } catch (e) {}
    throw new Error(`cannot start ${MSTSC}: ${err.message}`)
  }
  removeLater(file)
  return { file }
}

exports.isSupported = isSupported
exports.buildRdpFileContent = buildRdpFileContent
exports.launchNativeRdp = launchNativeRdp
