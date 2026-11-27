const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Readable } = require('stream')
const { createHash } = require('crypto')
const { execFileSync } = require('child_process')
const { format, assetFor, download } = require('@electerm/updater/release')
const { archiveRoot } = require('@electerm/updater')

test('normalizes plain-text update feeds to an exact desktop release tag', async () => {
  const { default: normalizeReleaseTag } = await import('../../app/common/normalize-release-tag.mjs')
  for (const raw of ['v5.15.0', 'v5.15.0\n', '\uFEFF5.15.0\r\n']) {
    assert.equal(normalizeReleaseTag(raw), 'v5.15.0')
  }
  for (const raw of [null, {}, '', '<html>v5.15.0</html>', 'v5.15.0\nv5.16.0', 'v5.15.0/extra']) {
    assert.equal(normalizeReleaseTag(raw), '')
  }
})

function temporary (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-updater-test-'))
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 100 }))
  return dir
}

test('matches the exact release variant and excludes store packages and metadata', () => {
  for (const [platform, sources] of Object.entries({
    win32: ['win7.tar.gz', 'win-x64-loose.tar.gz', 'win-x64-portable.tar.gz', 'win-arm64-installer.exe'],
    linux: ['linux-amd64.deb', 'linux-aarch64-legacy.rpm', 'linux-loongarch64-legacy.deb', 'linux-ppc64el.deb', 'linux-riscv64.tar.gz', 'linux-armv7l-legacy.AppImage'],
    darwin: ['mac10-x64.dmg', 'mac-arm64.dmg']
  })) {
    const release = { tag_name: 'v1.2.3', assets: sources.map(src => ({ name: 'electerm-1.2.3-' + src, size: 1, digest: 'sha256:' + 'a'.repeat(64) })) }
    for (const src of sources) {
      assert.ok(format(src, platform))
      assert.equal(assetFor(release, 'v1.2.3', src).name, 'electerm-1.2.3-' + src)
    }
    assert.throws(() => assetFor(release, 'v1.2.4', sources[0]))
  }
  for (const [platform, src] of [['win32', 'win-x64.appx'], ['linux', 'linux-amd64.snap'], ['darwin', 'mac-x64.dmg.blockmap'], ['darwin', 'linux-x64.tar.gz']]) {
    assert.throws(() => format(src, platform))
  }
})

test('updater supports every Electerm language', () => {
  const { locale } = require('@electerm/updater')
  const ids = Object.keys(require('@electerm/electerm-locales'))
  for (const id of ids) assert.equal(locale(id).language, id)
})

test('verifies mirrored downloads with the per-asset Electerm checksum', async t => {
  const src = 'win-x64.tar.gz'
  const name = 'electerm-1.2.3-' + src
  const digest = createHash('sha256').update('good').digest('hex')
  let body = 'good'
  t.mock.method(require('axios'), 'create', () => ({
    get: async url => {
      if (url === 'https://electerm.org/sha256/' + name + '.checksum') return { data: digest + '  ' + name }
      assert.equal(url, 'https://r2.electerm.org/r/' + name)
      return { data: Readable.from([Buffer.from(body)]) }
    }
  }))
  const run = () => download({ tag: 'v1.2.3', src, mirror: 'r2' }, temporary(t), () => {})
  assert.equal(fs.readFileSync(await run(), 'utf8'), 'good')
  for (body of ['go', 'evil']) await assert.rejects(run, /verification/)
})

test('finds flat, wrapped and loose archives and rejects ambiguous layouts', t => {
  const dir = temporary(t)
  const root = path.join(dir, 'versioned folder')
  fs.mkdirSync(path.join(root, 'resources/app'), { recursive: true })
  fs.writeFileSync(path.join(root, 'electerm.exe'), '')
  fs.writeFileSync(path.join(root, 'resources/app/package.json'), '{}')
  assert.equal(archiveRoot(dir, 'electerm.exe'), root)
  assert.equal(archiveRoot(root, 'electerm.exe'), root)
  fs.cpSync(root, path.join(dir, 'another'), { recursive: true })
  assert.throws(() => archiveRoot(dir, 'electerm.exe'))
})

test('archive install replaces application resources and preserves adjacent user data', { skip: process.platform === 'darwin' }, t => {
  const dir = temporary(t)
  const job = fs.mkdtempSync(path.join(dir, 'electerm-update-'))
  const target = path.join(dir, 'installed app')
  const payload = path.join(job, 'new app')
  for (const root of [target, payload]) fs.mkdirSync(path.join(root, 'resources'), { recursive: true })
  const windows = process.platform === 'win32'
  const profile = path.join(target, windows ? 'electerm' : 'user-data')
  fs.mkdirSync(profile)
  fs.writeFileSync(path.join(profile, 'settings'), 'keep')
  fs.writeFileSync(path.join(target, 'resources/obsolete'), 'old')
  fs.writeFileSync(path.join(payload, 'resources/app.asar'), 'new')
  const script = windows ? 'install.ps1' : 'install.sh'
  const copy = path.join(job, script)
  fs.copyFileSync(require.resolve('@electerm/updater/' + script), copy)
  if (windows) {
    // A GUI-subsystem fixture exits immediately without opening a window.
    execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "Add-Type -TypeDefinition 'public class Fixture { public static void Main() {} }' -OutputAssembly electerm.exe -OutputType WindowsApplication"
    ], { cwd: payload })
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', copy, 'tar.gz', payload, target, '0'], { timeout: 20000 })
  } else {
    fs.writeFileSync(path.join(payload, 'electerm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    execFileSync('/bin/sh', [copy, 'tar.gz', payload, target, '0'])
  }
  assert.equal(fs.readFileSync(path.join(profile, 'settings'), 'utf8'), 'keep')
  assert.equal(fs.readFileSync(path.join(target, 'resources/app.asar'), 'utf8'), 'new')
  assert.equal(fs.existsSync(path.join(target, 'resources/obsolete')), false)
})
