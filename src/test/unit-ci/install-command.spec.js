/**
 * `Install command to PATH` (settings > common) is a filesystem/registry
 * side-effect with three very different platform shapes, so the decision logic
 * lives in src/app/lib/install-command.js and is exercised here with injected
 * platform/execPath/binDirs/execFile - no Electron, no real /usr/local/bin, no
 * PowerShell.
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
  getCommandTarget,
  getBinDirCandidates,
  isInPath,
  normalizePathEntry,
  resolveBinDir,
  readLinkInfo,
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
  const dir = fs.mkdtempSync(path.join(base, name))
  return dir
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
      getCommandTarget({
        platform: 'darwin',
        execPath: '/Applications/electerm.app/Contents/MacOS/electerm',
        env: {}
      }),
      '/Applications/electerm.app/Contents/MacOS/electerm'
    )
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

describe('install-command: posix symlink lifecycle', () => {
  test('creates a symlink in the first writable candidate dir', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')

    const res = await installCommand({
      platform: 'linux',
      execPath,
      env: { PATH: dir + ':/usr/bin' },
      home: base,
      binDirs: [dir]
    })

    assert.equal(res.ok, true)
    assert.equal(res.action, 'created')
    assert.equal(res.inPath, true)
    assert.equal(res.linkPath, path.join(dir, 'electerm'))
    assert.equal(fs.readlinkSync(res.linkPath), execPath)
    assert.equal(fs.lstatSync(res.linkPath).isSymbolicLink(), true)
  })

  test('is idempotent - a second install reports exists, not a duplicate', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    const opts = {
      platform: 'darwin',
      execPath,
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    }
    await installCommand(opts)
    const again = await installCommand(opts)
    assert.equal(again.ok, true)
    assert.equal(again.action, 'exists')
  })

  test('re-points a stale symlink at the current binary', async () => {
    const dir = tmpDir('bin-')
    const oldExe = path.join(base, 'electerm-old')
    const newExe = path.join(base, 'electerm-new')
    fs.writeFileSync(oldExe, '')
    fs.writeFileSync(newExe, '')
    const baseOpts = {
      platform: 'linux',
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    }
    await installCommand({ ...baseOpts, execPath: oldExe })
    const res = await installCommand({ ...baseOpts, execPath: newExe })
    assert.equal(res.ok, true)
    assert.equal(res.action, 'updated')
    assert.equal(fs.readlinkSync(res.linkPath), newExe)
  })

  test('refuses to clobber a real file that is not a symlink', async () => {
    const dir = tmpDir('bin-')
    const linkPath = path.join(dir, 'electerm')
    fs.writeFileSync(linkPath, '#!/bin/sh\necho not ours\n')
    const res = await installCommand({
      platform: 'linux',
      execPath: path.join(base, 'electerm'),
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    })
    assert.equal(res.ok, false)
    assert.equal(res.action, 'blocked')
    assert.match(res.message, /not a symlink/)
    // the pre-existing file must survive untouched
    assert.equal(fs.readFileSync(linkPath, 'utf8'), '#!/bin/sh\necho not ours\n')
  })

  test('creates a missing per-user bin dir instead of failing', async () => {
    const home = tmpDir('home-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    const binDir = path.join(home, '.local', 'bin')
    const res = await installCommand({
      platform: 'linux',
      execPath,
      env: { PATH: '/usr/bin' },
      home,
      binDirs: [binDir]
    })
    assert.equal(res.ok, true)
    assert.equal(res.action, 'created')
    assert.equal(fs.existsSync(binDir), true)
    // and it is honest that the new dir is not on PATH yet
    assert.equal(res.inPath, false)
  })

  test('reports an error when the dir cannot be created', async () => {
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    const blocked = path.join(base, 'not-a-dir')
    fs.writeFileSync(blocked, '')
    const res = await installCommand({
      platform: 'linux',
      execPath,
      env: { PATH: '/usr/bin' },
      home: '/nonexistent-home-xyz',
      binDirs: [blocked]
    })
    assert.equal(res.ok, false)
    assert.equal(res.action, 'error')
  })

  test('uninstall removes the symlink, and is a no-op when absent', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    const opts = {
      platform: 'linux',
      execPath,
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    }
    await installCommand(opts)
    const first = await uninstallCommand(opts)
    assert.equal(first.ok, true)
    assert.equal(first.removed, true)
    assert.equal(fs.existsSync(path.join(dir, 'electerm')), false)

    const second = await uninstallCommand(opts)
    assert.equal(second.ok, true)
    assert.equal(second.removed, false)
  })

  test('uninstall leaves a foreign regular file alone', async () => {
    const dir = tmpDir('bin-')
    fs.writeFileSync(path.join(dir, 'electerm'), 'x')
    const res = await uninstallCommand({
      platform: 'linux',
      execPath: path.join(base, 'electerm'),
      home: base,
      binDirs: [dir]
    })
    assert.equal(res.removed, false)
    assert.equal(fs.existsSync(path.join(dir, 'electerm')), true)
  })
})

describe('install-command: posix status', () => {
  test('reports not-installed with a planned dir before install', async () => {
    const dir = tmpDir('bin-')
    const st = await getCommandStatus({
      platform: 'linux',
      execPath: path.join(base, 'electerm'),
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    })
    assert.equal(st.installed, false)
    assert.equal(st.binDir, dir)
    assert.equal(st.linkPath, path.join(dir, 'electerm'))
  })

  test('reports installed after install, and stale after the target moves', async () => {
    const dir = tmpDir('bin-')
    const execPath = path.join(base, 'electerm')
    fs.writeFileSync(execPath, '')
    const opts = {
      platform: 'linux',
      execPath,
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    }
    await installCommand(opts)
    const st = await getCommandStatus(opts)
    assert.equal(st.installed, true)
    assert.equal(st.inPath, true)
    assert.equal(st.stale, false)

    const moved = await getCommandStatus({ ...opts, execPath: execPath + '-2' })
    assert.equal(moved.installed, false)
    assert.equal(moved.stale, true)
  })

  test('flags a foreign regular file as blocked', async () => {
    const dir = tmpDir('bin-')
    fs.writeFileSync(path.join(dir, 'electerm'), 'x')
    const st = await getCommandStatus({
      platform: 'linux',
      execPath: path.join(base, 'electerm'),
      env: { PATH: dir },
      home: base,
      binDirs: [dir]
    })
    assert.equal(st.installed, false)
    assert.equal(st.blocked, true)
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
    assert.equal(res.ok, true)
    assert.equal(res.action, 'path-exists')
    // no change -> no broadcast round trip
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
    assert.equal(st.inPath, true)
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

  test('the install script compares with -ieq so an existing entry is not duplicated', () => {
    assert.match(WIN_INSTALL_SCRIPT, /-ieq/)
    assert.match(WIN_UNINSTALL_SCRIPT, /-ine/)
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
    const src = fs.readFileSync(
      path.join(ROOT, 'src/app/lib/ipc.js'),
      'utf8'
    )
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
    assert.match(src, /<InstallCommand\s*\/>/)
    assert.match(src, /isWebApp \? null : <InstallCommand/)
  })
})

describe('install-command: helpers', () => {
  test('readLinkInfo distinguishes absent / symlink / regular file', () => {
    const dir = tmpDir('rl-')
    const link = path.join(dir, 'link')
    const file = path.join(dir, 'file')
    fs.writeFileSync(file, 'x')
    fs.symlinkSync(file, link)
    assert.deepEqual(readLinkInfo(link), {
      exists: true,
      isSymlink: true,
      link: file
    })
    assert.deepEqual(readLinkInfo(file), { exists: true, isSymlink: false })
    assert.deepEqual(readLinkInfo(path.join(dir, 'nope')), {
      exists: false,
      isSymlink: false
    })
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
