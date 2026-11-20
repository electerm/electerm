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
 * Two Windows facts shape this module:
 *
 * 1. mstsc has no password switch. The two supported ways in are a
 *    `password 51:b:` line inside the .rdp file (a CryptProtectData blob) or a
 *    credential in the Windows Credential Manager that mstsc picks up by itself.
 *    This module uses the credential manager: making the DPAPI blob needs
 *    PowerShell, and Windows 7 ships PowerShell 2.0, where calling
 *    ProtectedData::Protect reliably is not worth the risk. It also keeps the
 *    password off the disk entirely -- the temp .rdp file holds host, user and
 *    options only.
 * 2. mstsc reuses one process: a second mstsc.exe call usually hands its
 *    arguments to the already running instance and exits immediately. So the
 *    temp file cannot be deleted on child exit; it goes on a timer.
 *
 * Requires nothing but Node builtins, which is what lets the unit test in
 * src/test/unit-ci/native-rdp-win.spec.js run without installing anything.
 */

const { spawn, execFile } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_PORT = 3389
const MSTSC = 'mstsc.exe'
const CMDKEY = 'cmdkey.exe'
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
 * Credential Manager targets mstsc looks up for an RDP connection: `TERMSRV/<host>`
 * for the default port, plus `TERMSRV/<host>:<port>` when a custom port is used.
 * Which one mstsc asks for has differed between Windows versions, so both are
 * written when the port is not 3389 (and both are cleared again).
 * @param {{host: string, port: number}} options
 * @returns {string[]}
 */
function credentialTargets ({ host, port }) {
  const target = `TERMSRV/${host}`
  const portNum = normalizePort(port)
  return portNum === DEFAULT_PORT
    ? [target]
    : [target, `${target}:${portNum}`]
}

/**
 * cmdkey takes the whole logon name, mstsc takes user and domain separately.
 * A user name that already carries its domain (`DOM\user`) or is a UPN
 * (`user@example.com`) must not be prefixed again.
 * @param {{username: string, domain: string}} options
 * @returns {string}
 */
function qualifiedUser ({ username, domain }) {
  if (!username) {
    return ''
  }
  if (!domain || /[\\@]/.test(username)) {
    return username
  }
  return `${domain}\\${username}`
}

/**
 * cmdkey splits its own command line at spaces and only honours a quote that
 * reaches it verbatim. `execFile`'s default quoting wraps the whole argument
 * ("/pass:pa ss"), which cmdkey rejects with "this parameter requires /U" and
 * stores nothing -- verified on Windows 11. Quoting just the value
 * (/pass:"pa ss") works, which is why the runner below passes the argv verbatim.
 * A value carrying a double quote cannot be expressed that way, so it is left
 * unquoted on purpose: cmdkey then refuses it and mstsc asks for the password.
 * @param {string} value
 * @returns {string}
 */
function quoteValue (value) {
  const str = value === undefined || value === null ? '' : String(value)
  if (!/\s/.test(str) || str.includes('"')) {
    return str
  }
  return `"${str}"`
}

/**
 * @param {{target: string, username: string, domain: string, password: string}} options
 * @returns {string[]} argv for cmdkey
 */
function buildCmdkeyArgs ({ target, username, domain, password }) {
  const args = [`/generic:${target}`]
  const user = qualifiedUser({ username, domain })
  if (user) {
    args.push(`/user:${quoteValue(user)}`)
  }
  // never a shell: the password cannot be interpreted as anything but a value
  args.push(`/pass:${quoteValue(password)}`)
  return args
}

/**
 * @param {object} options
 * @param {string} options.host
 * @param {number} [options.port]
 * @param {string} [options.username]
 * @param {string} [options.domain]
 * @param {boolean} [options.hasPassword] saved credential available
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
    // 0 = use the stored credential without asking. Without one, asking up front
    // beats a connection that fails for no visible reason
    `prompt for credentials:i:${options.hasPassword ? 0 : 1}`,
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

function runCmdkey (args) {
  return new Promise((resolve, reject) => {
    // windowsVerbatimArguments: the values in `args` are already quoted for
    // cmdkey's own parser (see quoteValue); letting execFile quote them again
    // makes cmdkey reject every value containing a space
    const options = { windowsHide: true, windowsVerbatimArguments: true }
    execFile(systemExe(CMDKEY), args, options, (err, stdout, stderr) => {
      if (err) {
        // cmdkey reports its complaints on stdout, not stderr
        const detail = String(stderr || '').trim() ||
          String(stdout || '').trim() ||
          err.message
        // args[0] is the target only: the password is never logged
        reject(new Error(`${CMDKEY} ${args[0]} failed: ${detail}`))
        return
      }
      resolve(String(stdout || '').trim())
    })
  })
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
 * Store the credential and start mstsc.
 * @param {object} options see buildRdpFileContent, plus options.password
 * @returns {Promise<{file: string, credentialStored: boolean, warnings: string[]}>}
 */
async function launchNativeRdp (options = {}) {
  if (!isSupported()) {
    throw new Error('opening the local RDP client is only supported on Windows')
  }
  const host = normalizeHost(options.host)
  const port = normalizePort(options.port)
  const username = singleLine(options.username, 'username')
  const domain = singleLine(options.domain, 'domain')
  const password = options.password === undefined || options.password === null
    ? ''
    : singleLine(options.password, 'password')
  // cmdkey needs a user name together with the password. Without one there is
  // nothing to store, and mstsc has to ask for both itself.
  const hasPassword = !!password && !!username
  const warnings = []
  // ...and a double quote cannot survive cmdkey's parser at all (see quoteValue)
  const storeCredential = hasPassword && !password.includes('"')
  if (hasPassword && !storeCredential) {
    warnings.push('the password contains a double quote and is not stored for the local RDP client')
  }
  if (storeCredential) {
    for (const target of credentialTargets({ host, port })) {
      try {
        await runCmdkey(buildCmdkeyArgs({ target, username, domain, password }))
      } catch (err) {
        // a credential that cannot be stored must not stop the connection:
        // mstsc falls back to asking for the password itself
        warnings.push(err.message)
      }
    }
  }
  // a credential that was meant to be stored but was not means mstsc finds
  // nothing on its own, so the .rdp has to ask up front
  const credentialStored = storeCredential && warnings.length === 0
  const content = buildRdpFileContent({
    host,
    port,
    username,
    domain,
    hasPassword: credentialStored,
    nla: options.nla
  })
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
  return {
    file,
    credentialStored,
    warnings
  }
}

/**
 * Forget the credential this module stored for a host. "no such credential" is
 * reported per target instead of thrown: nothing about it is worth fixing.
 * @param {{host: string, port: number}} options
 * @returns {Promise<Array<{target: string, ok: boolean, error?: string}>>}
 */
async function clearRdpCredential (options = {}) {
  if (!isSupported()) {
    throw new Error('opening the local RDP client is only supported on Windows')
  }
  const host = normalizeHost(options.host)
  const results = []
  for (const target of credentialTargets({ host, port: options.port })) {
    try {
      await runCmdkey([`/delete:${target}`])
      results.push({ target, ok: true })
    } catch (err) {
      results.push({ target, ok: false, error: err.message })
    }
  }
  return results
}

exports.isSupported = isSupported
exports.credentialTargets = credentialTargets
exports.qualifiedUser = qualifiedUser
exports.buildCmdkeyArgs = buildCmdkeyArgs
exports.buildRdpFileContent = buildRdpFileContent
exports.launchNativeRdp = launchNativeRdp
exports.clearRdpCredential = clearRdpCredential
