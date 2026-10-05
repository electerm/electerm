/**
 * Install the `electerm` command into PATH.
 *
 * Covered by src/test/unit-ci/install-command.spec.js, which runs with plain
 * `node --test` (no Electron), so this file must NOT require electron at load
 * time. Everything platform-specific is read from the passed-in options, not
 * from module scope, so the logic is testable on any host.
 *
 * Platform behaviour:
 * - macOS: write a one-line `exec` WRAPPER SCRIPT. Never a symlink - see below.
 * - Linux: symlink named `electerm` in the first writable candidate dir.
 *   Linux AppImage is special: process.execPath lives inside an ephemeral
 *   squashfs mount, so the symlink points at $APPIMAGE instead.
 * - Windows: append the folder holding electerm.exe to the *user* PATH
 *   (HKCU\Environment) so a newly opened shell resolves `electerm`.
 *
 * ## Why macOS gets a wrapper and not a symlink
 *
 * Electron resolves its Helper apps from the process's own executable path:
 * `MainApplicationBundlePath()` (shell/common/mac/main_application_bundle.mm)
 * does `PathService::Get(FILE_EXE)` and walks up, and
 * `OverrideChildProcessPath()` (shell/app/electron_main_delegate_mac.mm) then
 * `LOG(FATAL)`s with "Unable to find helper app" when the result is not inside
 * a `.app`. `GetHelperAppPath`'s fallback name comes from
 * `GetApplicationName()`, i.e. `[NSBundle mainBundle]` - likewise derived from
 * the executable path.
 *
 * On macOS `_NSGetExecutablePath()` returns a symlink **unresolved**. Measured
 * on the project's dev machine:
 *
 *   symlink  /tmp/x/python-link -> .../python3   _NSGetExecutablePath = /tmp/x/python-link
 *   wrapper  exec ".../python3" "$@"             _NSGetExecutablePath = .../python3
 *
 * So a symlink in /usr/local/bin can make Electron look for
 * `/usr/local/Contents/Frameworks/...` and abort; a wrapper that execs the
 * real path keeps the executable inside the bundle. This is the same shape
 * VS Code ships (`/usr/local/bin/code` -> a script inside the bundle).
 *
 * The wrapper also `unset ELECTRON_RUN_AS_NODE`, because a terminal belonging
 * to another Electron app (an IDE's integrated terminal) exports it, and an
 * Electron binary that sees it starts a Node runtime instead of the app.
 *
 * The functions are async (Windows shells out to PowerShell); the posix paths
 * are synchronous internally but return a promise for a single call shape.
 *
 * ## The `packaged` guard
 *
 * In an unpackaged run `process.execPath` is the Electron binary, not electerm
 * (measured: `/Users/zxd/dev/electerm/node_modules/electron/dist/Electron.app/
 * Contents/MacOS/Electron`). Installing from there would repoint the user's
 * `electerm` command at bare Electron and break it, so every write is refused
 * unless `packaged` is true, and `getCommandStatus` reports `unpackaged: true`
 * so the settings row can explain itself instead of offering the buttons. The
 * default is `true` (the packaged app's case); ipc.js passes `app.isPackaged`.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const CMD_NAME = 'electerm'
const POWERSHELL = 'powershell.exe'
const WRAPPER_MARKER = '# electerm command wrapper'

function pathApi (platform) {
  return platform === 'win32' ? path.win32 : path.posix
}

// macOS must use a wrapper (see the header); linux symlinks are safe because
// Chromium reads /proc/self/exe, which the kernel already resolves.
function getCommandShape (platform) {
  return platform === 'darwin' ? 'wrapper' : 'symlink'
}

// Linux AppImage runs from a temporary squashfs mount; $APPIMAGE is the stable
// file the user actually launched.
function getCommandTarget ({ platform, execPath, env = {} }) {
  if (platform === 'linux' && env.APPIMAGE) {
    return env.APPIMAGE
  }
  return execPath
}

// Preference order. The first entry that exists and is writable wins; if none
// exists we create the first per-user entry instead.
function getBinDirCandidates ({ platform, home }) {
  const { join } = pathApi(platform)
  if (platform === 'darwin') {
    return [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      join(home, '.local', 'bin'),
      join(home, 'bin')
    ]
  }
  if (platform === 'linux') {
    return [
      '/usr/local/bin',
      join(home, '.local', 'bin'),
      join(home, 'bin')
    ]
  }
  return []
}

function isWritableDir (dir, fsImpl = fs) {
  try {
    if (!fsImpl.statSync(dir).isDirectory()) {
      return false
    }
    fsImpl.accessSync(dir, fs.constants.W_OK)
    return true
  } catch (e) {
    return false
  }
}

function isUnderHome (dir, home) {
  if (!home) {
    return false
  }
  const h = home.replace(/[\\/]+$/, '')
  return dir === h ||
    dir.startsWith(h + '/') ||
    dir.startsWith(h + '\\')
}

// PATH entries may be quoted or carry a trailing separator; Windows is
// case-insensitive. Normalise both sides before comparing.
function normalizePathEntry (dir, platform) {
  let d = String(dir).trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '')
  if (platform === 'win32') {
    d = d.toLowerCase()
  }
  return d
}

function isInPath (dir, pathEnv, platform) {
  if (!dir) {
    return false
  }
  const sep = platform === 'win32' ? ';' : ':'
  const target = normalizePathEntry(dir, platform)
  return String(pathEnv || '')
    .split(sep)
    .map(d => normalizePathEntry(d, platform))
    .filter(Boolean)
    .includes(target)
}

function resolveBinDir ({ platform, home, binDirs, fs: fsImpl = fs }) {
  const candidates = binDirs || getBinDirCandidates({ platform, home })
  const existing = candidates.find(dir => isWritableDir(dir, fsImpl))
  if (existing) {
    return { dir: existing, create: false }
  }
  const creatable = candidates.find(dir => isUnderHome(dir, home))
  if (creatable) {
    return { dir: creatable, create: true }
  }
  return { dir: candidates[0], create: false }
}

// Quote a path for a double-quoted POSIX shell string.
function shQuote (str) {
  return '"' + String(str).replace(/(["\\$`])/g, '\\$1') + '"'
}

function getWrapperContent (target) {
  return [
    '#!/bin/sh',
    WRAPPER_MARKER,
    '# launch electerm through its real path so it can find its Helper apps',
    'unset ELECTRON_RUN_AS_NODE',
    `exec ${shQuote(target)} "$@"`,
    ''
  ].join('\n')
}

// Inverse of getWrapperContent's exec line.
function parseWrapperTarget (content) {
  const m = /^exec\s+"((?:[^"\\]|\\.)*)"/m.exec(String(content || ''))
  if (!m) {
    return null
  }
  return m[1].replace(/\\(["\\$`])/g, '$1')
}

// Read only the head of a file: the bin dir may hold a real binary, and we
// only need enough bytes to recognise our own wrapper.
function readHead (file, fsImpl = fs, bytes = 512) {
  const fd = fsImpl.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const n = fsImpl.readSync(fd, buf, 0, bytes, 0)
    return buf.slice(0, n).toString('utf8')
  } finally {
    fsImpl.closeSync(fd)
  }
}

// Does this link point at an electerm binary? Only the symlink-shape platforms
// (linux) ever install one, so a symlink is only ever ours there - on macOS it
// belongs to somebody else and must be left alone.
function isElectermLink (link) {
  return /electerm/i.test(String(link || ''))
}

// `readlinkSync` throws EINVAL when the path exists but is a regular file, so
// fall back to reading the head to tell "not a symlink" from "absent".
// `shape` decides whether a symlink can be ours at all.
function readInstallInfo (file, fsImpl = fs, shape) {
  try {
    const link = fsImpl.readlinkSync(file)
    return {
      exists: true,
      isSymlink: true,
      link,
      isOurs: shape === 'symlink' && isElectermLink(link)
    }
  } catch (e) {
    // not a symlink (or absent) - fall through
  }
  try {
    const content = readHead(file, fsImpl)
    return {
      exists: true,
      isSymlink: false,
      content,
      isOurs: content.includes(WRAPPER_MARKER)
    }
  } catch (e2) {
    return { exists: false, isSymlink: false, isOurs: false }
  }
}

function isUpToDate (info, target, shape) {
  if (!info.exists || !info.isOurs) {
    return false
  }
  if (shape === 'wrapper') {
    return !info.isSymlink &&
      String(info.content || '').trim() === getWrapperContent(target).trim()
  }
  return info.isSymlink && info.link === target
}

function findEntry ({ platform, candidates, shape, fs: fsImpl = fs }) {
  const { join } = pathApi(platform)
  for (const dir of candidates) {
    const file = join(dir, CMD_NAME)
    const info = readInstallInfo(file, fsImpl, shape)
    if (info.exists) {
      return { dir, file, ...info }
    }
  }
  return null
}

function runPowerShell (script, extraEnv, execFileImpl) {
  return new Promise((resolve, reject) => {
    execFileImpl(
      POWERSHELL,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ],
      {
        windowsHide: true,
        timeout: 20000,
        env: { ...process.env, ...extraEnv }
      },
      (err, stdout) => {
        if (err) {
          reject(err)
          return
        }
        resolve(String(stdout || '').trim())
      }
    )
  })
}

const WIN_READ_PATH_SCRIPT =
  '[Environment]::GetEnvironmentVariable("Path", "User")'

// Appends the bin dir to the user PATH only when it is not already there.
// Uses [Environment]::SetEnvironmentVariable rather than setx, which truncates
// PATH at 1024 chars and expands %VAR% references.
const WIN_INSTALL_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '$d = $env:ELECTERM_BIN_DIR',
  '$cur = [Environment]::GetEnvironmentVariable("Path", "User")',
  'if ($null -eq $cur) { $cur = "" }',
  '$parts = @($cur -split ";" | Where-Object { $_ -ne "" })',
  '$hit = @($parts | Where-Object { $_.TrimEnd("\\") -ieq $d.TrimEnd("\\") })',
  'if ($hit.Count -gt 0) { "exists" } else { $next = (@($parts) + $d) -join ";"; [Environment]::SetEnvironmentVariable("Path", $next, "User"); "added" }'
].join('; ')

const WIN_UNINSTALL_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '$d = $env:ELECTERM_BIN_DIR',
  '$cur = [Environment]::GetEnvironmentVariable("Path", "User")',
  'if ($null -eq $cur) { $cur = "" }',
  '$parts = @($cur -split ";" | Where-Object { $_ -ne "" })',
  '$next = @($parts | Where-Object { $_.TrimEnd("\\") -ine $d.TrimEnd("\\") })',
  'if ($next.Count -eq $parts.Count) { "absent" } else { [Environment]::SetEnvironmentVariable("Path", ($next -join ";"), "User"); "removed" }'
].join('; ')

// Best effort: tell already-running processes (Explorer, terminals) that the
// environment changed. Failure here must never fail the install.
const WIN_BROADCAST_SCRIPT = `
$sig = '[DllImport("user32.dll", CharSet=CharSet.Auto, SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'
$type = Add-Type -MemberDefinition $sig -Name Win32SendMessage -Namespace Electerm -PassThru
$result = [UIntPtr]::Zero
$type::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result) | Out-Null
`.trim()

async function getCommandStatus (options = {}) {
  const {
    platform = process.platform,
    execPath = process.execPath,
    env = process.env,
    home = os.homedir(),
    packaged = true,
    binDirs,
    fs: fsImpl = fs,
    execFile: execFileImpl = execFile
  } = options

  const target = getCommandTarget({ platform, execPath, env })
  // See installCommand: in a dev run execPath is Electron, so nothing here is
  // actionable and the renderer shows an explanation instead of the buttons.
  const unpackaged = !packaged

  if (platform === 'win32') {
    const binDir = pathApi(platform).dirname(execPath)
    let pathValue = ''
    let error = null
    try {
      pathValue = await runPowerShell(WIN_READ_PATH_SCRIPT, {}, execFileImpl)
    } catch (err) {
      error = err.message
    }
    const inPath = isInPath(binDir, pathValue, platform)
    return {
      platform,
      unpackaged,
      installed: inPath,
      inPath,
      binDir,
      linkPath: null,
      target,
      error
    }
  }

  const shape = getCommandShape(platform)
  const candidates = binDirs || getBinDirCandidates({ platform, home })
  const found = findEntry({ platform, candidates, shape, fs: fsImpl })
  if (found) {
    const link = found.isSymlink ? found.link : parseWrapperTarget(found.content)
    const installed = found.isOurs && link === target
    return {
      platform,
      shape,
      unpackaged,
      installed,
      stale: !installed && found.isOurs,
      blocked: !found.isOurs,
      inPath: isInPath(found.dir, env.PATH, platform),
      binDir: found.dir,
      linkPath: found.file,
      link,
      target
    }
  }

  const { dir } = resolveBinDir({ platform, home, binDirs, fs: fsImpl })
  return {
    platform,
    shape,
    unpackaged,
    installed: false,
    stale: false,
    blocked: false,
    inPath: isInPath(dir, env.PATH, platform),
    binDir: dir,
    linkPath: pathApi(platform).join(dir, CMD_NAME),
    target
  }
}

async function installWindows ({ execPath, platform, execFile: execFileImpl }) {
  const binDir = pathApi(platform).dirname(execPath)
  let out
  try {
    out = await runPowerShell(
      WIN_INSTALL_SCRIPT,
      { ELECTERM_BIN_DIR: binDir },
      execFileImpl
    )
  } catch (err) {
    return {
      platform,
      ok: false,
      action: 'error',
      binDir,
      linkPath: null,
      target: execPath,
      inPath: false,
      message: err.message
    }
  }
  const action = out === 'exists' ? 'path-exists' : 'path-added'
  if (action === 'path-added') {
    try {
      await runPowerShell(WIN_BROADCAST_SCRIPT, {}, execFileImpl)
    } catch (e) {
      // non-fatal: the PATH change is already persisted
    }
  }
  return {
    platform,
    ok: true,
    action,
    binDir,
    linkPath: null,
    target: execPath,
    inPath: true
  }
}

async function installCommand (options = {}) {
  const {
    platform = process.platform,
    execPath = process.execPath,
    env = process.env,
    home = os.homedir(),
    packaged = true,
    binDirs,
    fs: fsImpl = fs,
    execFile: execFileImpl = execFile
  } = options

  const target = getCommandTarget({ platform, execPath, env })

  if (!packaged) {
    // In a dev run process.execPath is the Electron binary, so installing would
    // repoint the user's `electerm` command at Electron itself and break it.
    return {
      platform,
      ok: false,
      action: 'unpackaged',
      binDir: null,
      linkPath: null,
      target,
      inPath: false,
      message: 'the electerm command can only be installed from a packaged build'
    }
  }

  if (platform === 'win32') {
    return installWindows({
      execPath,
      platform,
      execFile: execFileImpl
    })
  }

  const shape = getCommandShape(platform)
  const { dir, create } = resolveBinDir({
    platform,
    home,
    binDirs,
    fs: fsImpl
  })
  const linkPath = pathApi(platform).join(dir, CMD_NAME)
  const base = {
    platform,
    shape,
    binDir: dir,
    linkPath,
    target,
    inPath: isInPath(dir, env.PATH, platform)
  }

  try {
    if (create) {
      fsImpl.mkdirSync(dir, { recursive: true })
    }
    const info = readInstallInfo(linkPath, fsImpl, shape)
    if (isUpToDate(info, target, shape)) {
      return { ...base, ok: true, action: 'exists' }
    }
    if (info.exists && !info.isOurs) {
      return {
        ...base,
        ok: false,
        action: 'blocked',
        message: linkPath + ' exists and was not created by electerm'
      }
    }
    if (shape === 'wrapper') {
      // Atomic replace via rename: a reader never sees a half-written wrapper,
      // and there is no window where the command does not exist.
      const tmp = linkPath + '.electerm-tmp'
      fsImpl.writeFileSync(tmp, getWrapperContent(target), { mode: 0o755 })
      // writeFileSync's mode is masked by umask, so set the exec bit explicitly
      fsImpl.chmodSync(tmp, 0o755)
      fsImpl.renameSync(tmp, linkPath)
    } else {
      if (info.exists) {
        fsImpl.unlinkSync(linkPath)
      }
      fsImpl.symlinkSync(target, linkPath)
    }
    return { ...base, ok: true, action: info.exists ? 'updated' : 'created' }
  } catch (err) {
    return { ...base, ok: false, action: 'error', message: err.message }
  }
}

async function uninstallCommand (options = {}) {
  const {
    platform = process.platform,
    execPath = process.execPath,
    home = os.homedir(),
    packaged = true,
    binDirs,
    fs: fsImpl = fs,
    execFile: execFileImpl = execFile
  } = options

  if (!packaged) {
    return {
      platform,
      ok: false,
      removed: false,
      message: 'the electerm command can only be changed from a packaged build'
    }
  }

  if (platform === 'win32') {
    const binDir = pathApi(platform).dirname(execPath)
    let out
    try {
      out = await runPowerShell(
        WIN_UNINSTALL_SCRIPT,
        { ELECTERM_BIN_DIR: binDir },
        execFileImpl
      )
    } catch (err) {
      return {
        platform,
        ok: false,
        removed: false,
        binDir,
        message: err.message
      }
    }
    const removed = out !== 'absent'
    if (removed) {
      try {
        await runPowerShell(WIN_BROADCAST_SCRIPT, {}, execFileImpl)
      } catch (e) {
        // non-fatal
      }
    }
    return { platform, ok: true, removed, binDir }
  }

  const shape = getCommandShape(platform)
  const candidates = binDirs || getBinDirCandidates({ platform, home })
  const found = findEntry({ platform, candidates, shape, fs: fsImpl })
  if (!found || !found.isOurs) {
    return { platform, ok: true, removed: false }
  }
  try {
    fsImpl.unlinkSync(found.file)
    return {
      platform,
      ok: true,
      removed: true,
      binDir: found.dir,
      linkPath: found.file
    }
  } catch (err) {
    return {
      platform,
      ok: false,
      removed: false,
      binDir: found.dir,
      linkPath: found.file,
      message: err.message
    }
  }
}

module.exports = {
  CMD_NAME,
  WRAPPER_MARKER,
  getCommandShape,
  getCommandTarget,
  getBinDirCandidates,
  isWritableDir,
  isUnderHome,
  isInPath,
  normalizePathEntry,
  resolveBinDir,
  shQuote,
  getWrapperContent,
  parseWrapperTarget,
  readHead,
  readInstallInfo,
  isElectermLink,
  isUpToDate,
  findEntry,
  getCommandStatus,
  installCommand,
  uninstallCommand,
  WIN_INSTALL_SCRIPT,
  WIN_UNINSTALL_SCRIPT,
  WIN_READ_PATH_SCRIPT,
  WIN_BROADCAST_SCRIPT
}
