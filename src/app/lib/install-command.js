/**
 * Install the `electerm` command into PATH.
 *
 * Covered by src/test/unit-ci/install-command.spec.js, which runs with plain
 * `node --test` (no Electron), so this file must NOT require electron at load
 * time. Everything platform-specific is read from the passed-in options, not
 * from module scope, so the logic is testable on any host.
 *
 * Platform behaviour:
 * - macOS / Linux: create a symlink named `electerm` in the first writable
 *   directory from the preference list (`/usr/local/bin`, then Homebrew's
 *   `/opt/homebrew/bin` on mac, then `~/.local/bin`, then `~/bin`).
 *   Linux AppImage is special: process.execPath lives inside an ephemeral
 *   squashfs mount, so the symlink points at $APPIMAGE instead.
 * - Windows: append the folder holding electerm.exe to the *user* PATH
 *   (HKCU\Environment) so a newly opened shell resolves `electerm`.
 *
 * The functions are async (Windows shells out to PowerShell); the posix paths
 * are synchronous internally but return a promise for a single call shape.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const CMD_NAME = 'electerm'
const POWERSHELL = 'powershell.exe'

function pathApi (platform) {
  return platform === 'win32' ? path.win32 : path.posix
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

// `readlinkSync` throws EINVAL when the path exists but is a regular file, so
// fall back to lstat to tell "not a symlink" from "absent".
function readLinkInfo (linkPath, fsImpl = fs) {
  try {
    return {
      exists: true,
      isSymlink: true,
      link: fsImpl.readlinkSync(linkPath)
    }
  } catch (e) {
    try {
      fsImpl.lstatSync(linkPath)
      return { exists: true, isSymlink: false }
    } catch (e2) {
      return { exists: false, isSymlink: false }
    }
  }
}

function findLink ({ platform, candidates, fs: fsImpl = fs }) {
  const { join } = pathApi(platform)
  for (const dir of candidates) {
    const linkPath = join(dir, CMD_NAME)
    const info = readLinkInfo(linkPath, fsImpl)
    if (info.exists) {
      return { dir, linkPath, ...info }
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
    binDirs,
    fs: fsImpl = fs,
    execFile: execFileImpl = execFile
  } = options

  const target = getCommandTarget({ platform, execPath, env })

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
      installed: inPath,
      inPath,
      binDir,
      linkPath: null,
      target,
      error
    }
  }

  const candidates = binDirs || getBinDirCandidates({ platform, home })
  const found = findLink({ platform, candidates, fs: fsImpl })
  if (found) {
    const installed = found.isSymlink && found.link === target
    return {
      platform,
      installed,
      stale: !installed,
      blocked: !found.isSymlink,
      inPath: isInPath(found.dir, env.PATH, platform),
      binDir: found.dir,
      linkPath: found.linkPath,
      link: found.link,
      target
    }
  }

  const { dir } = resolveBinDir({ platform, home, binDirs, fs: fsImpl })
  return {
    platform,
    installed: false,
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
    binDirs,
    fs: fsImpl = fs,
    execFile: execFileImpl = execFile
  } = options

  const target = getCommandTarget({ platform, execPath, env })

  if (platform === 'win32') {
    return installWindows({
      execPath,
      platform,
      execFile: execFileImpl
    })
  }

  const { dir, create } = resolveBinDir({
    platform,
    home,
    binDirs,
    fs: fsImpl
  })
  const linkPath = pathApi(platform).join(dir, CMD_NAME)
  const base = {
    platform,
    binDir: dir,
    linkPath,
    target,
    inPath: isInPath(dir, env.PATH, platform)
  }

  try {
    if (create) {
      fsImpl.mkdirSync(dir, { recursive: true })
    }
    const info = readLinkInfo(linkPath, fsImpl)
    if (info.isSymlink && info.link === target) {
      return { ...base, ok: true, action: 'exists' }
    }
    if (info.exists && !info.isSymlink) {
      return {
        ...base,
        ok: false,
        action: 'blocked',
        message: linkPath + ' exists and is not a symlink'
      }
    }
    if (info.exists) {
      fsImpl.unlinkSync(linkPath)
    }
    fsImpl.symlinkSync(target, linkPath)
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
    binDirs,
    fs: fsImpl = fs,
    execFile: execFileImpl = execFile
  } = options

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

  const candidates = binDirs || getBinDirCandidates({ platform, home })
  const found = findLink({ platform, candidates, fs: fsImpl })
  if (!found || !found.isSymlink) {
    return { platform, ok: true, removed: false }
  }
  try {
    fsImpl.unlinkSync(found.linkPath)
    return {
      platform,
      ok: true,
      removed: true,
      binDir: found.dir,
      linkPath: found.linkPath
    }
  } catch (err) {
    return {
      platform,
      ok: false,
      removed: false,
      binDir: found.dir,
      linkPath: found.linkPath,
      message: err.message
    }
  }
}

module.exports = {
  CMD_NAME,
  getCommandTarget,
  getBinDirCandidates,
  isWritableDir,
  isUnderHome,
  isInPath,
  normalizePathEntry,
  resolveBinDir,
  readLinkInfo,
  findLink,
  getCommandStatus,
  installCommand,
  uninstallCommand,
  WIN_INSTALL_SCRIPT,
  WIN_UNINSTALL_SCRIPT,
  WIN_READ_PATH_SCRIPT,
  WIN_BROADCAST_SCRIPT
}
