/**
 * Tests for the arch -> release asset resolution in build/npm/install.js
 *
 * This is the table that decides which Linux/Windows/macOS build `npm i -g
 * electerm` installs. It is easy to get wrong silently: an arch that is missing
 * here used to fall through to `linux-x64.tar.gz`, which produces an install
 * that cannot even exec on the target machine. riscv64/ppc64le/loong64 are the
 * variants that made that visible.
 *
 * The asset names below mirror a real release (see
 * https://electerm.org/data/electerm-github-release.json). install.js picks an
 * asset with `name.endsWith(filePattern)`, so the tests assert on that exact
 * rule: every target must match exactly one published asset.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  getDownloadTarget,
  LINUX_TARGETS
} = require('../../../build/npm/install')

const v = '5.5.15'

// Non-.tar.gz assets are in here on purpose: the pattern must not match them.
const releaseFiles = [
  // linux tar.gz (what npm install uses)
  `electerm-${v}-linux-x64.tar.gz`,
  `electerm-${v}-linux-x64-legacy.tar.gz`,
  `electerm-${v}-linux-arm64.tar.gz`,
  `electerm-${v}-linux-arm64-legacy.tar.gz`,
  `electerm-${v}-linux-armv7l.tar.gz`,
  `electerm-${v}-linux-armv7l-legacy.tar.gz`,
  `electerm-${v}-linux-loong64.tar.gz`,
  `electerm-${v}-linux-loong64-legacy.tar.gz`,
  `electerm-${v}-linux-riscv64.tar.gz`,
  `electerm-${v}-linux-ppc64le.tar.gz`,
  // linux other formats
  `electerm-${v}-linux-amd64.deb`,
  `electerm-${v}-linux-amd64-legacy.deb`,
  `electerm-${v}-linux-aarch64.rpm`,
  `electerm-${v}-linux-ppc64el.deb`,
  `electerm-${v}-linux-riscv64.deb`,
  `electerm-${v}-linux-loongarch64.deb`,
  `electerm-${v}-linux-x86_64.AppImage`,
  `electerm-${v}-linux-arm64.AppImage`,
  `electerm-${v}-linux-amd64.snap`,
  // mac / win
  `electerm-${v}-mac-x64.dmg`,
  `electerm-${v}-mac-arm64.dmg`,
  `electerm-${v}-mac10-x64.dmg`,
  `electerm-${v}-win-x64.tar.gz`,
  `electerm-${v}-win-x64-loose.tar.gz`,
  `electerm-${v}-win-x64-portable.tar.gz`,
  `electerm-${v}-win-arm64.tar.gz`,
  `electerm-${v}-win7.tar.gz`
]

// Same filter install.js uses when scanning release assets
const matchAssets = (filePattern) =>
  releaseFiles.filter(name => name.endsWith(filePattern))

function assertMatchesExactlyOne (target) {
  const matches = matchAssets(target.filePattern)
  assert.equal(
    matches.length,
    1,
    `${target.type} -> ${target.filePattern} matched ${JSON.stringify(matches)}`
  )
  return matches[0]
}

describe('getDownloadTarget: linux', () => {
  const cases = [
    ['x64', 'linux-x64.tar.gz'],
    ['ia32', 'linux-x64.tar.gz'],
    ['arm64', 'linux-arm64.tar.gz'],
    ['aarch64', 'linux-arm64.tar.gz'],
    ['arm', 'linux-armv7l.tar.gz'],
    ['armv7l', 'linux-armv7l.tar.gz'],
    ['loong64', 'linux-loong64.tar.gz'],
    ['riscv64', 'linux-riscv64.tar.gz'],
    ['ppc64le', 'linux-ppc64le.tar.gz'],
    ['ppc64', 'linux-ppc64le.tar.gz']
  ]

  for (const [arch, expected] of cases) {
    it(`${arch} resolves to ${expected}`, () => {
      const target = getDownloadTarget('linux', arch, { legacy: false })
      assert.equal(target.type, expected.replace('.tar.gz', ''))
      assert.equal(target.filePattern, expected)
      assertMatchesExactlyOne(target)
      assert.ok(!target.legacyUnavailable)
    })
  }

  it('every mapped arch knows its legacy variant', () => {
    for (const [arch, entry] of Object.entries(LINUX_TARGETS)) {
      assert.equal(
        typeof entry.legacy,
        'boolean',
        `${arch} must declare whether it has a legacy build`
      )
    }
  })
})

describe('getDownloadTarget: linux legacy (glibc < 2.34)', () => {
  for (const arch of ['x64', 'arm64', 'arm', 'loong64']) {
    it(`${arch} switches to the -legacy build`, () => {
      const target = getDownloadTarget('linux', arch, { legacy: true })
      assert.ok(target.type.endsWith('-legacy'))
      assertMatchesExactlyOne(target)
      assert.ok(!target.legacyUnavailable)
    })
  }

  // riscv64/ppc64le electron runtimes are only published against a newer glibc,
  // so no -legacy asset exists. Asking for one used to fail with
  // "No release found for pattern: linux-riscv64-legacy.tar.gz".
  for (const arch of ['riscv64', 'ppc64le', 'ppc64']) {
    it(`${arch} falls back to the standard build with a flag`, () => {
      const target = getDownloadTarget('linux', arch, { legacy: true })
      assert.ok(!target.type.endsWith('-legacy'))
      assert.equal(target.legacyUnavailable, true)
      assertMatchesExactlyOne(target)
    })
  }
})

describe('getDownloadTarget: ppc64 endianness', () => {
  it('accepts little-endian ppc64', () => {
    const target = getDownloadTarget('linux', 'ppc64', {
      legacy: false,
      endianness: 'LE'
    })
    assert.equal(target.type, 'linux-ppc64le')
  })

  it('rejects big-endian ppc64 instead of installing a ppc64le build', () => {
    const target = getDownloadTarget('linux', 'ppc64', {
      legacy: false,
      endianness: 'BE'
    })
    assert.equal(target.type, 'unsupported')
    assert.match(target.reason, /big-endian/)
  })
})

describe('getDownloadTarget: unsupported', () => {
  // These used to fall through to linux-x64.tar.gz and install a binary the
  // machine cannot run.
  for (const arch of ['s390x', 'mips', 'mipsel', 'ppc', 'unknown']) {
    it(`linux ${arch} is reported as unsupported`, () => {
      const target = getDownloadTarget('linux', arch, { legacy: false })
      assert.equal(target.type, 'unsupported')
      assert.match(target.reason, /not supported/)
    })
  }

  it('non desktop platforms are unsupported', () => {
    assert.equal(getDownloadTarget('freebsd', 'x64', {}).type, 'unsupported')
    assert.equal(getDownloadTarget('sunos', 'x64', {}).type, 'unsupported')
  })
})

describe('getDownloadTarget: win32', () => {
  const cases = [
    ['x64', {}, 'win-x64.tar.gz'],
    ['ia32', {}, 'win-x64.tar.gz'],
    ['arm64', {}, 'win-arm64.tar.gz'],
    ['x64', { win7: true }, 'win7.tar.gz']
  ]

  for (const [arch, options, expected] of cases) {
    it(`${arch} ${JSON.stringify(options)} resolves to ${expected}`, () => {
      const target = getDownloadTarget('win32', arch, options)
      assert.equal(target.filePattern, expected)
      assertMatchesExactlyOne(target)
    })
  }
})

describe('getDownloadTarget: darwin', () => {
  const cases = [
    ['x64', {}, 'mac-x64.dmg'],
    ['ia32', {}, 'mac-x64.dmg'],
    ['arm64', {}, 'mac-arm64.dmg'],
    ['x64', { mac10: true }, 'mac10-x64.dmg']
  ]

  for (const [arch, options, expected] of cases) {
    it(`${arch} ${JSON.stringify(options)} resolves to ${expected}`, () => {
      const target = getDownloadTarget('darwin', arch, options)
      assert.equal(target.filePattern, expected)
      assertMatchesExactlyOne(target)
    })
  }
})
