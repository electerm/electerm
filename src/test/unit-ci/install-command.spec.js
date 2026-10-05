/**
 * `Install command to PATH` (settings > common) is a filesystem/registry
 * side-effect with three very different platform shapes, so the decision logic
 * lives in src/app/lib/install-command.js and is exercised here with injected
 * platform/execPath/binDirs/execFile - no Electron, no real /usr/local/bin, no
 * PowerShell.
 *
 * The macOS shape is a wrapper SCRIPT, not a symlink. A symlink makes
 * `_NSGetExecutablePath()` return a path with no `.app` above it, and Electron
 * derives its Helper app locations from exactly that value
 * (`MainApplicationBundlePath()`), so it aborts with "Unable to find helper
 * app". The tests below pin that macOS never produces a symlink again - and
 * that a symlink already sitting at the path is treated as a foreign file
 * (blocked, never adopted), since installing one is the bug.
 *
 * Lives in unit-ci/ (not unit/) because src/test/unit/ is not wired into any
 * npm script or workflow - a suite there does not run in CI.
 */

const { test, describe, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  WRAPPER_MARKER,
  getCommandShape,
  getCommandTarget,
  getBinDirCandidates,
  isInPath,
  normalizePathEntry,
  resolveBinDir,
  shQuote,
  getWrapperContent,
  parseWrapperTarget,
  readInstallInfo,
  isUpToDate,
  getCommandStatus,
  installCommand,
  uninstallCommand,
  WIN_INSTALL_SCRIPT,
  WIN_UNINSTALL_SCRIPT
} = require('../../app/lib/install-command')

const ROOT = path.resolve(__dirname, '../../..')
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-install-cmd-'))

after(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

function tmpDir (name) {
  return fs.mkdtempSync(path.join(base, name))
}

// Stands in for child_process.execFile. `responder` maps the call index to the
// stdout the real PowerShell would have printed.
function fakeExecFile (responder) {
  const calls = []
  const fn = (file, args, opts, cb) => {
    calls.push({ file, args, opts })
    const out = typeof responder === 'function'
      ? responder(calls.length, args, opts)
      : responder
    cb(null, out, '')
  }
  fn.calls = calls
  return fn
}

const WIN_EXE =
  'C:\\Users\\me\\AppData\\Local\\Programs\\electerm\\electerm.exe'
const WIN_DIR = 'C:\\Users\\me\\AppData\\Local\\Programs\\electerm'

const MAC_APP = '/Applications/electerm.app/Contents/MacOS/electerm'

describe('install-command: which binary the command points at', () => {
  test('linux AppImage links the stable $APPIMAGE, not the temp mount', () => {
    assert.equal(
      getCommandTarget({
        platform: 'linux',
        execPath: '/tmp/.mount_electerm123/electerm',
        env: { APPIMAGE: '/home/me/Applications/electerm.AppImage' }
      }),
      '/home/me/Applications/electerm.AppImage'
    )
  })

  test('linux without APPIMAGE uses execPath', () => {
    assert.equal(
      getCommandTarget({
        platform: 'linux',
        execPath: '/opt/electerm/electerm',
        env: {}
      }),
      '/opt/electerm/electerm'
    )
  })

  test('mac uses the bundle binary', () => {
    assert.equal(
      getCommandTarget({ platform: 'darwin', execPath: MAC_APP, env: {} }),
      MAC_APP
    )
  })
})

describe('install-command: shape per platform', () => {
  test('macOS uses a wrapper, never a symlink', () => {
    assert.equal(getCommandShape('darwin'), 'wrapper')
  })

  test('linux keeps the symlink (Chromium reads /proc/self/exe there)', () => {
    assert.equal(getCommandShape('linux'), 'symlink')
  })
})

describe('install-command: wrapper content', () => {
  test('execs the real binary and clears ELECTRON_RUN_AS_NODE', () => {
    const c = getWrapperContent(MAC_APP)
    assert.match(c, /^#!\/bin\/sh/)
    assert.ok(c.includes(WRAPPER_MARKER))
    assert.match(c, /unset ELECTRON_RUN_AS_NODE/)
    assert.equal(parseWrapperTarget(c), MAC_APP)
    // no relative lookup, no readlink indirection
    assert.equal(/readlink|\$0|dirname/.test(c), false)
  })

  test('survives a path with spaces and shell metacharacters', () => {
    const weird = '/Applications/My $Apps/electerm "beta".app/Contents/MacOS/electerm'
    const c = getWrapperContent(weird)
    assert.equal(parseWrapperTarget(c), weird)
    // the literal path must not appear unquoted
    assert.ok(!c.includes(`exec ${weird}`))
  })

  test('shQuote escapes double quotes, backslashes, $ and backticks', () => {
    assert.equal(shQuote('a"b'), '"a\\"b"')
    assert.equal(shQuote('a\\b'), '"a\\\\b"')
    assert.equal(shQuote('a$b'), '"a\\$b"')
    assert.equal(shQuote('a`b'), '"a\\`b"')
  })

  test('parseWrapperTarget returns null for a non-wrapper file', () => {
    assert.equal(parseWrapperTarget('#!/bin/sh\necho hi\n'), null)
    assert.equal(parseWrapperTarget(''), null)
  })
})

describe('install-command: bin dir candidates', () => {
  const home = '/home/me'

  test('mac prefers /usr/local/bin, then Homebrew, then per-user dirs', () => {
    const dirs = getBinDirCandidates({ platform: 'darwin', home })
    assert.equal(dirs[0], '/usr/local/bin')
    assert.ok(dirs.includes('/opt/homebrew/bin'))
    assert.ok(dirs.includes('/home/me/.local/bin'))
    assert.ok(dirs.includes('/home/me/bin'))
  })

  test('linux has no Homebrew entry', () => {
    const dirs = getBinDirCandidates({ platform: 'linux', home })
    assert.equal(dirs[0], '/usr/local/bin')
    assert.ok(!dirs.includes('/opt/homebrew/bin'))
    assert.ok(dirs.includes('/home/me/.local/bin'))
  })

  test('windows uses the exe folder, not a bin dir list', () => {
    assert.deepEqual(getBinDirCandidates({ platform: 'win32', home }), [])
  })
})

describe('install-command: PATH membership', () => {
  test('posix exact match', () => {
    assert.equal(isInPath('/usr/local/bin', '/usr/bin:/usr/local/bin:/bin', 'linux'), true)
    assert.equal(isInPath('/usr/local/bin', '/usr/bin:/bin', 'linux'), false)
  })

  test('posix tolerates a trailing separator', () => {
    assert.equal(isInPath('/usr/local/bin', '/usr/bin:/usr/local/bin/', 'linux'), true)
  })

  test('windows is case-insensitive and tolerates trailing separators', () => {
    const p = 'C:\\Windows;C:\\Tools\\'
    assert.equal(isInPath('c:\\tools', p, 'win32'), true)
    assert.equal(isInPath('C:\\Tools\\', p, 'win32'), true)
    assert.equal(isInPath('C:\\Other', p, 'win32'), false)
  })

  test('windows strips quotes around a PATH entry', () => {
    assert.equal(
      isInPath(
        'C:\\Program Files\\electerm',
        'C:\\Windows;"C:\\Program Files\\electerm"',
        'win32'
      ),
      true
    )
  })

  test('empty dir never matches', () => {
    assert.equal(isInPath('', '', 'linux'), false)
    assert.equal(isInPath(null, 'C:\\Windows', 'win32'), false)
  })

  test('normalizePathEntry leaves posix case alone', () => {
    assert.equal(normalizePathEntry('/Usr/Local/', 'linux'), '/Usr/Local')
    assert.equal(normalizePathEntry('/Usr/Local/', 'win32'), '/usr/local')
  })
})

describe('install-command: macOS wrapper lifecycle', () => {
  const macOpts = (dir, execPath, extra = {}) => ({
    platform: 'darwin',
    execPath,
    env: { PATH: dir + ':/usr/bin' },
    home: base,
    binDirs: [dir],
    ...extra
  })

  test('writes an executable wrapper, not a symlink', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm.app', 'Contents', 'MacOS', 'electerm')
    const res = await installCommand(macOpts(dir, execPath))

    assert.equal(res.ok, true)
    assert.equal(res.action, 'created')
    assert.equal(res.shape, 'wrapper')
    assert.equal(res.inPath, true)

    const st = fs.lstatSync(res.linkPath)
    assert.equal(st.isSymbolicLink(), false, 'macOS must not install a symlink')
    assert.equal(st.isFile(), true)
    assert.notEqual(st.mode & 0o111, 0, 'wrapper must be executable')

    const content = fs.readFileSync(res.linkPath, 'utf8')
    assert.ok(content.includes(WRAPPER_MARKER))
    assert.equal(parseWrapperTarget(content), execPath)
    // the whole point: the path handed to exec is the real, bundle-internal one
    assert.ok(execPath.includes('.app/Contents/MacOS/'))
  })

  test('is idempotent - a second install reports exists', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm.app', 'Contents', 'MacOS', 'electerm')
    await installCommand(macOpts(dir, execPath))
    const again = await installCommand(macOpts(dir, execPath))
    assert.equal(again.ok, true)
    assert.equal(again.action, 'exists')
  })

  test('leaves no temp file behind (atomic replace)', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm.app', 'Contents', 'MacOS', 'electerm')
    await installCommand(macOpts(dir, execPath))
    await installCommand(macOpts(dir, execPath))
    assert.deepEqual(fs.readdirSync(dir), ['electerm'])
  })

  test('re-points a wrapper left behind by a moved app', async () => {
    const dir = tmpDir('bin-')
    const oldExe = path.join(base, 'old.app', 'Contents', 'MacOS', 'electerm')
    const newExe = path.join(base, 'new.app', 'Contents', 'MacOS', 'electerm')
    await installCommand(macOpts(dir, oldExe))
    const res = await installCommand(macOpts(dir, newExe))
    assert.equal(res.action, 'updated')
    assert.equal(parseWrapperTarget(fs.readFileSync(res.linkPath, 'utf8')), newExe)
  })

  test('refuses to clobber a file it did not create', async () => {
    const dir = tmpDir('bin-')
    const linkPath = path.join(dir, 'electerm')
    fs.writeFileSync(linkPath, '#!/bin/sh\necho not ours\n')
    const res = await installCommand(macOpts(dir, MAC_APP))
    assert.equal(res.ok, false)
    assert.equal(res.action, 'blocked')
    assert.match(res.message, /not created by electerm/)
    assert.equal(fs.readFileSync(linkPath, 'utf8'), '#!/bin/sh\necho not ours\n')
  })

  test('creates a missing per-user bin dir and admits it is not on PATH', async () => {
    const home = tmpDir('home-')
    const binDir = path.join(home, '.local', 'bin')
    const res = await installCommand({
      platform: 'darwin',
      execPath: MAC_APP,
      env: { PATH: '/usr/bin' },
      home,
      binDirs: [binDir]
    })
    assert.equal(res.ok, true)
    assert.equal(fs.existsSync(binDir), true)
    assert.equal(res.inPath, false)
  })

  test('uninstall removes the wrapper, and is a no-op when absent', async () => {
    const dir = tmpDir('bin-')
    const opts = macOpts(dir, MAC_APP)
    await installCommand(opts)
    const first = await uninstallCommand(opts)
    assert.equal(first.removed, true)
    assert.equal(fs.existsSync(path.join(dir, 'electerm')), false)

    const second = await uninstallCommand(opts)
    assert.equal(second.removed, false)
  })

  test('never touches a symlink on macOS', async () => {
    // a symlink at this path is somebody else's file: installing a symlink is
    // what used to break the app, so electerm must not create or adopt one
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm.app', 'Contents', 'MacOS', 'electerm')
    const linkPath = path.join(dir, 'electerm')
    fs.symlinkSync(execPath, linkPath)

    const res = await installCommand(macOpts(dir, execPath))

    assert.equal(res.ok, false, JSON.stringify(res))
    assert.equal(res.action, 'blocked', JSON.stringify(res))
    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true)
    assert.equal(fs.readlinkSync(linkPath), execPath)
  })

  test('uninstall leaves a foreign file alone', async () => {
    const dir = tmpDir('bin-')
    fs.writeFileSync(path.join(dir, 'electerm'), 'x')
    const res = await uninstallCommand(macOpts(dir, MAC_APP))
    assert.equal(res.removed, false)
    assert.equal(fs.existsSync(path.join(dir, 'electerm')), true)
  })
})

describe('install-command: macOS status', () => {
  const opts = (dir, execPath) => ({
    platform: 'darwin',
    execPath,
    env: { PATH: dir },
    home: base,
    binDirs: [dir]
  })

  test('not installed, with a planned dir, before install', async () => {
    const dir = tmpDir('bin-')
    const st = await getCommandStatus(opts(dir, MAC_APP))
    assert.equal(st.installed, false)
    assert.equal(st.stale, false)
    assert.equal(st.shape, 'wrapper')
    assert.equal(st.linkPath, path.join(dir, 'electerm'))
  })

  test('installed after install, stale after the app moves', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm.app', 'Contents', 'MacOS', 'electerm')
    await installCommand(opts(dir, execPath))
    const st = await getCommandStatus(opts(dir, execPath))
    assert.equal(st.installed, true)
    assert.equal(st.stale, false)
    assert.equal(st.inPath, true)

    const moved = await getCommandStatus(opts(dir, execPath + '-moved'))
    assert.equal(moved.installed, false)
    assert.equal(moved.stale, true)
  })

  test('a symlink on macOS is blocked, not adopted', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm.app', 'Contents', 'MacOS', 'electerm')
    fs.symlinkSync(execPath, path.join(dir, 'electerm'))
    const st = await getCommandStatus(opts(dir, execPath))
    assert.equal(st.installed, false)
    assert.equal(st.stale, false)
    assert.equal(st.blocked, true)
  })

  test('flags a foreign file as blocked', async () => {
    const dir = tmpDir('bin-')
    fs.writeFileSync(path.join(dir, 'electerm'), 'x')
    const st = await getCommandStatus(opts(dir, MAC_APP))
    assert.equal(st.installed, false)
    assert.equal(st.blocked, true)
    assert.equal(st.stale, false)
  })
})

describe('install-command: linux symlink lifecycle (unchanged)', () => {
  const linOpts = (dir, execPath) => ({
    platform: 'linux',
    execPath,
    env: { PATH: dir + ':/usr/bin' },
    home: base,
    binDirs: [dir]
  })

  test('creates a symlink, not a wrapper', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    const res = await installCommand(linOpts(dir, execPath))
    assert.equal(res.ok, true)
    assert.equal(res.action, 'created')
    assert.equal(res.shape, 'symlink')
    assert.equal(fs.lstatSync(res.linkPath).isSymbolicLink(), true)
    assert.equal(fs.readlinkSync(res.linkPath), execPath)
  })

  test('is idempotent and re-points a stale symlink', async () => {
    const dir = tmpDir('bin-')
    const oldExe = path.join(base, 'electerm-old')
    const newExe = path.join(base, 'electerm-new')
    fs.writeFileSync(oldExe, '')
    fs.writeFileSync(newExe, '')
    await installCommand(linOpts(dir, oldExe))
    assert.equal((await installCommand(linOpts(dir, oldExe))).action, 'exists')
    const res = await installCommand(linOpts(dir, newExe))
    assert.equal(res.action, 'updated')
    assert.equal(fs.readlinkSync(res.linkPath), newExe)
  })

  test('status: installed, then stale after the target moves', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    await installCommand(linOpts(dir, execPath))
    assert.equal((await getCommandStatus(linOpts(dir, execPath))).installed, true)
    const moved = await getCommandStatus(linOpts(dir, execPath + '-2'))
    assert.equal(moved.installed, false)
    assert.equal(moved.stale, true)
  })

  test('refuses to clobber a real file', async () => {
    const dir = tmpDir('bin-')
    const linkPath = path.join(dir, 'electerm')
    fs.writeFileSync(linkPath, '#!/bin/sh\necho not ours\n')
    const res = await installCommand(linOpts(dir, path.join(base, 'electerm')))
    assert.equal(res.ok, false)
    assert.equal(res.action, 'blocked')
    assert.equal(fs.readFileSync(linkPath, 'utf8'), '#!/bin/sh\necho not ours\n')
  })

  test('uninstall removes the symlink, and is a no-op when absent', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    await installCommand(linOpts(dir, execPath))
    assert.equal((await uninstallCommand(linOpts(dir, execPath))).removed, true)
    assert.equal((await uninstallCommand(linOpts(dir, execPath))).removed, false)
  })
})

describe('install-command: the unpackaged (dev) guard', () => {
  // In a dev run process.execPath is the Electron binary, so installing would
  // repoint the user's `electerm` command at Electron.
  const devOpts = (dir, extra = {}) => ({
    platform: 'darwin',
    execPath: '/repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    env: { PATH: dir },
    home: base,
    binDirs: [dir],
    packaged: false,
    ...extra
  })

  test('install is refused and writes nothing', async () => {
    const dir = tmpDir('bin-')
    const res = await installCommand(devOpts(dir))
    assert.equal(res.ok, false)
    assert.equal(res.action, 'unpackaged')
    assert.match(res.message, /packaged build/)
    assert.deepEqual(fs.readdirSync(dir), [])
  })

  test('uninstall is refused and removes nothing', async () => {
    const dir = tmpDir('bin-')
    const file = path.join(dir, 'electerm')
    fs.writeFileSync(file, getWrapperContent(MAC_APP), { mode: 0o755 })
    const res = await uninstallCommand(devOpts(dir))
    assert.equal(res.ok, false)
    assert.equal(res.removed, false)
    assert.equal(fs.existsSync(file), true)
  })

  test('windows install is refused too, before PowerShell runs', async () => {
    const fake = fakeExecFile('added\n')
    const res = await installCommand({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: fake,
      packaged: false
    })
    assert.equal(res.action, 'unpackaged')
    assert.equal(fake.calls.length, 0)
  })

  test('status reports unpackaged so the UI can explain itself', async () => {
    const dir = tmpDir('bin-')
    const st = await getCommandStatus(devOpts(dir))
    assert.equal(st.unpackaged, true)
    assert.equal(st.installed, false)

    // ...and the packaged case does not
    const ok = await getCommandStatus({ ...devOpts(dir), packaged: true })
    assert.equal(ok.unpackaged, false)
  })

  test('packaged defaults to true, so the app path is unaffected', async () => {
    const dir = tmpDir('bin-')
    const res = await installCommand({
      platform: 'darwin',
      execPath: MAC_APP,
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    })
    assert.equal(res.ok, true)
    assert.equal(res.action, 'created')
  })

  test('the main process passes app.isPackaged through', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/app/lib/ipc.js'), 'utf8')
    assert.equal(
      (src.match(/packaged: app\.isPackaged/g) || []).length,
      3,
      'all three handlers must pass the packaged flag'
    )
  })
})

describe('install-command: windows user PATH', () => {
  test('appends the exe folder to the user PATH', async () => {
    const fake = fakeExecFile('added\n')
    const res = await installCommand({
      platform: 'win32',
      execPath: WIN_EXE,
      env: { PATH: 'C:\\Windows' },
      execFile: fake
    })
    assert.equal(res.ok, true)
    assert.equal(res.action, 'path-added')
    assert.equal(res.binDir, WIN_DIR)
    assert.equal(res.inPath, true)

    const call = fake.calls[0]
    assert.match(call.file, /powershell/i)
    assert.ok(call.args.includes('-Command'))
    // the dir is handed over via env, never interpolated into the script
    assert.equal(call.opts.env.ELECTERM_BIN_DIR, WIN_DIR)
    assert.equal(call.args.includes(WIN_DIR), false)
  })

  test('is a no-op when the folder is already on the user PATH', async () => {
    const fake = fakeExecFile('exists\n')
    const res = await installCommand({
      platform: 'win32',
      execPath: WIN_EXE,
      env: { PATH: 'C:\\Windows' },
      execFile: fake
    })
    assert.equal(res.action, 'path-exists')
    assert.equal(fake.calls.length, 1)
  })

  test('broadcasts an environment change after a real edit', async () => {
    const fake = fakeExecFile('added\n')
    await installCommand({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: fake
    })
    assert.equal(fake.calls.length, 2)
    assert.match(fake.calls[1].args.join(' '), /SendMessageTimeout/)
  })

  test('status reads the user PATH from the registry', async () => {
    const onPath = fakeExecFile('C:\\Windows;' + WIN_DIR + '\n')
    const st = await getCommandStatus({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: onPath
    })
    assert.equal(st.installed, true)
    assert.equal(st.binDir, WIN_DIR)

    const offPath = fakeExecFile('C:\\Windows\n')
    const st2 = await getCommandStatus({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: offPath
    })
    assert.equal(st2.installed, false)
  })

  test('status survives a PowerShell failure without throwing', async () => {
    const broken = (file, args, opts, cb) => cb(new Error('powershell missing'))
    const st = await getCommandStatus({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: broken
    })
    assert.equal(st.installed, false)
    assert.match(st.error, /powershell missing/)
  })

  test('uninstall drops the folder from the user PATH', async () => {
    const fake = fakeExecFile('removed\n')
    const res = await uninstallCommand({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: fake
    })
    assert.equal(res.ok, true)
    assert.equal(res.removed, true)
    assert.equal(res.binDir, WIN_DIR)
  })

  test('uninstall reports absent when the folder was never added', async () => {
    const fake = fakeExecFile('absent\n')
    const res = await uninstallCommand({
      platform: 'win32',
      execPath: WIN_EXE,
      env: {},
      execFile: fake
    })
    assert.equal(res.removed, false)
    assert.equal(fake.calls.length, 1)
  })

  test('never uses setx (it truncates PATH at 1024 chars)', () => {
    assert.match(WIN_INSTALL_SCRIPT, /SetEnvironmentVariable/)
    assert.doesNotMatch(WIN_INSTALL_SCRIPT, /setx/i)
    assert.match(WIN_UNINSTALL_SCRIPT, /SetEnvironmentVariable/)
    assert.doesNotMatch(WIN_UNINSTALL_SCRIPT, /setx/i)
  })

  test('the install script compares with -ieq so an entry is not duplicated', () => {
    assert.match(WIN_INSTALL_SCRIPT, /-ieq/)
    assert.match(WIN_UNINSTALL_SCRIPT, /-ine/)
  })
})

describe('install-command: helpers', () => {
  test('readInstallInfo distinguishes absent / symlink / wrapper / foreign', () => {
    const dir = tmpDir('rl-')
    const target = '/Applications/electerm.app/Contents/MacOS/electerm'
    const link = path.join(dir, 'link')
    const wrap = path.join(dir, 'wrap')
    const foreign = path.join(dir, 'foreign')
    fs.symlinkSync(target, link)
    fs.writeFileSync(wrap, getWrapperContent(target))
    fs.writeFileSync(foreign, '#!/bin/sh\necho hi\n')

    const a = readInstallInfo(link, fs, 'symlink')
    assert.equal(a.exists, true)
    assert.equal(a.isSymlink, true)
    assert.equal(a.isOurs, true)

    const b = readInstallInfo(wrap, fs, 'wrapper')
    assert.equal(b.exists, true)
    assert.equal(b.isSymlink, false)
    assert.equal(b.isOurs, true)

    const c = readInstallInfo(foreign, fs, 'wrapper')
    assert.equal(c.exists, true)
    assert.equal(c.isOurs, false)

    assert.deepEqual(readInstallInfo(path.join(dir, 'nope'), fs, 'wrapper'), {
      exists: false,
      isSymlink: false,
      isOurs: false
    })
  })

  test('a symlink is only ever ours on a symlink-shape platform', () => {
    const dir = tmpDir('rl-')
    const target = '/Applications/electerm.app/Contents/MacOS/electerm'
    const link = path.join(dir, 'electerm')
    fs.symlinkSync(target, link)

    assert.equal(readInstallInfo(link, fs, 'symlink').isOurs, true)
    assert.equal(readInstallInfo(link, fs, 'wrapper').isOurs, false)
  })

  test('isUpToDate is shape-aware', () => {
    const target = '/Applications/electerm.app/Contents/MacOS/electerm'
    const wrapperInfo = {
      exists: true,
      isSymlink: false,
      isOurs: true,
      content: getWrapperContent(target)
    }
    const linkInfo = { exists: true, isSymlink: true, isOurs: true, link: target }
    assert.equal(isUpToDate(wrapperInfo, target, 'wrapper'), true)
    assert.equal(isUpToDate(wrapperInfo, target, 'symlink'), false)
    assert.equal(isUpToDate(linkInfo, target, 'symlink'), true)
    assert.equal(isUpToDate(linkInfo, target, 'wrapper'), false)
    assert.equal(isUpToDate({ exists: false }, target, 'wrapper'), false)
  })

  test('resolveBinDir prefers an existing writable dir over creating one', () => {
    const home = tmpDir('home-')
    const existing = tmpDir('existing-')
    const missing = path.join(home, '.local', 'bin')
    const r = resolveBinDir({
      platform: 'linux',
      home,
      binDirs: [missing, existing]
    })
    assert.equal(r.dir, existing)
    assert.equal(r.create, false)
  })

  test('resolveBinDir falls back to creating a per-user dir', () => {
    const home = tmpDir('home-')
    const missing = path.join(home, '.local', 'bin')
    const r = resolveBinDir({
      platform: 'linux',
      home,
      binDirs: ['/definitely/not/writable/xyz', missing]
    })
    assert.equal(r.dir, missing)
    assert.equal(r.create, true)
  })
})

describe('install-command: testability guard', () => {
  test('the module does not require electron at load time', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/app/lib/install-command.js'),
      'utf8'
    )
    assert.doesNotMatch(
      src,
      /require\(['"]electron['"]\)/,
      'install-command.js must stay loadable under plain node --test'
    )
  })

  test('ipc exposes the three handlers', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/app/lib/ipc.js'), 'utf8')
    for (const name of [
      'getElectermCommandStatus',
      'installElectermCommand',
      'uninstallElectermCommand'
    ]) {
      assert.ok(src.includes(name), `${name} missing from ipc.js`)
    }
  })

  test('the settings page renders the control for the desktop app', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/client/components/setting-panel/setting-common.jsx'),
      'utf8'
    )
    assert.match(src, /isWebApp \? null : <InstallCommand/)
  })

  test('the control takes its labels from electerm-locales', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/client/components/setting-panel/install-command.jsx'),
      'utf8'
    )
    for (const key of ['command', 'install', 'uninstall']) {
      assert.ok(
        src.includes(`t('${key}')`),
        `${key} is not read from the locale pack`
      )
    }
  })

  test('the locale pack ships the three keys', () => {
    // same access path the e2e helper uses (src/test/e2e/common/lang.js)
    const lang = require('@electerm/electerm-locales').en_us.lang
    for (const key of ['command', 'install', 'uninstall']) {
      assert.equal(typeof lang[key], 'string', `${key} missing from en_us`)
    }
  })

  test('the control links to the wiki page for the feature', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/client/components/setting-panel/install-command.jsx'),
      'utf8'
    )
    assert.match(src, /HelpIcon link=\{installCommandHelpLink\}/)
    const constants = fs.readFileSync(
      path.join(ROOT, 'src/client/common/constants.js'),
      'utf8'
    )
    assert.match(
      constants,
      /installCommandHelpLink = 'https:\/\/github\.com\/electerm\/electerm\/wiki\/Install-electerm-command'/,
      'the wiki URL is a contract - a typo here ships a 404'
    )
  })
})
