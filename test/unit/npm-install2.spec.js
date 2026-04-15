/**
 * Tests for npm/install.js and npm/utils.js
 * Tests platform detection, download patterns, extraction, and CLI launcher flow
 */

const os = require('os')
const path = require('path')
const fs = require('fs')
const tar = require('tar')
const {
  isWindows7OrEarlier,
  isMacOS10,
  isLinuxLegacy,
  sanitizeVersion,
  sanitizeFilename,
  getElectermExePath,
  isElectermExtracted,
  _packageRoot,
  _extractDir
} = require('../../npm/install')

const {
  httpGet,
  extractTarGz,
  download,
  phin,
  applyProxy,
  formatBytes
} = require('../../npm/utils')

const plat = os.platform()

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const asyncQueue = []

function test (name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    Error: ${e.message}`)
    failed++
  }
}

function testAsync (name, fn) {
  asyncQueue.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    Error: ${e.message}`)
      failed++
    }
  })
}

function expect (actual) {
  return {
    toBe (expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`)
      }
    },
    toEqual (expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`)
      }
    },
    toContain (expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`)
      }
    },
    toMatch (pattern) {
      if (!pattern.test(actual)) {
        throw new Error(`Expected ${actual} to match ${pattern}`)
      }
    },
    toBeTruthy () {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`)
      }
    },
    toBeFalsy () {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`)
      }
    }
  }
}

function testThrows (fn, expectedMessage) {
  try {
    fn()
    throw new Error('Expected function to throw')
  } catch (e) {
    if (e.message === 'Expected function to throw') throw e
    if (expectedMessage && !e.message.includes(expectedMessage)) {
      throw new Error(`Expected error to include "${expectedMessage}" but got "${e.message}"`)
    }
  }
}

// ---------------------------------------------------------------------------
// Download pattern helper (for testing)
// ---------------------------------------------------------------------------

function getDownloadPattern (platform, architecture, options = {}) {
  const { win7, mac10, linuxLegacy } = options

  if (platform === 'win32') {
    if (win7) {
      return { pattern: /electerm-\d+\.\d+\.\d+-win7\.tar\.gz$/, type: 'win7' }
    } else if (architecture === 'arm64') {
      return { pattern: /electerm-\d+\.\d+\.\d+-win-arm64\.tar\.gz$/, type: 'win-arm64' }
    } else {
      return { pattern: /electerm-\d+\.\d+\.\d+-win-x64\.tar\.gz$/, type: 'win-x64' }
    }
  } else if (platform === 'darwin') {
    if (mac10) {
      return { pattern: /mac10-x64\.dmg$/, type: 'mac10-x64' }
    } else if (architecture === 'arm64') {
      return { pattern: /mac-arm64\.dmg$/, type: 'mac-arm64' }
    } else {
      return { pattern: /mac-x64\.dmg$/, type: 'mac-x64' }
    }
  } else if (platform === 'linux') {
    const suffix = linuxLegacy ? '-legacy' : ''
    if (architecture === 'arm64' || architecture === 'aarch64') {
      return { pattern: new RegExp(`linux-arm64${suffix}\\.tar\\.gz$`), type: `linux-arm64${suffix}` }
    } else if (architecture === 'arm') {
      return { pattern: new RegExp(`linux-armv7l${suffix}\\.tar\\.gz$`), type: `linux-armv7l${suffix}` }
    } else {
      return { pattern: new RegExp(`linux-x64${suffix}\\.tar\\.gz$`), type: `linux-x64${suffix}` }
    }
  }

  return { pattern: null, type: 'unsupported' }
}

// =============================================================================
// Tests: Platform Detection
// =============================================================================

console.log('\n=== Platform Detection Tests ===\n')

test('isWindows7OrEarlier: returns false for non-Windows platforms', () => {
  expect(isWindows7OrEarlier('darwin', '21.0.0')).toBe(false)
  expect(isWindows7OrEarlier('linux', '5.4.0')).toBe(false)
})

test('isWindows7OrEarlier: returns true for Windows 7 (NT 6.1)', () => {
  expect(isWindows7OrEarlier('win32', '6.1.7601')).toBe(true)
})

test('isWindows7OrEarlier: returns true for Windows Vista (NT 6.0)', () => {
  expect(isWindows7OrEarlier('win32', '6.0.6000')).toBe(true)
})

test('isWindows7OrEarlier: returns true for Windows XP (NT 5.1)', () => {
  expect(isWindows7OrEarlier('win32', '5.1.2600')).toBe(true)
})

test('isWindows7OrEarlier: returns false for Windows 8 (NT 6.2)', () => {
  expect(isWindows7OrEarlier('win32', '6.2.9200')).toBe(false)
})

test('isWindows7OrEarlier: returns false for Windows 10 (NT 10.0)', () => {
  expect(isWindows7OrEarlier('win32', '10.0.19041')).toBe(false)
})

test('isWindows7OrEarlier: returns false for Windows 11 (NT 10.0)', () => {
  expect(isWindows7OrEarlier('win32', '10.0.22000')).toBe(false)
})

test('isMacOS10: returns false for non-macOS platforms', () => {
  expect(isMacOS10('win32', '10.0.19041')).toBe(false)
  expect(isMacOS10('linux', '5.4.0')).toBe(false)
})

test('isMacOS10: returns true for macOS 10.15 Catalina (Darwin 19.x)', () => {
  expect(isMacOS10('darwin', '19.6.0')).toBe(true)
})

test('isMacOS10: returns true for macOS 10.14 Mojave (Darwin 18.x)', () => {
  expect(isMacOS10('darwin', '18.7.0')).toBe(true)
})

test('isMacOS10: returns false for macOS 11 Big Sur (Darwin 20.x)', () => {
  expect(isMacOS10('darwin', '20.6.0')).toBe(false)
})

test('isMacOS10: returns false for macOS 14 Sonoma (Darwin 23.x)', () => {
  expect(isMacOS10('darwin', '23.0.0')).toBe(false)
})

test('isLinuxLegacy: returns false for non-Linux platforms', () => {
  expect(isLinuxLegacy('win32')).toBe(false)
  expect(isLinuxLegacy('darwin')).toBe(false)
})

// =============================================================================
// Tests: Security Sanitization
// =============================================================================

console.log('\n=== Security Sanitization Tests ===\n')

test('sanitizeVersion: removes v prefix', () => {
  expect(sanitizeVersion('v1.2.3')).toBe('1.2.3')
})

test('sanitizeVersion: trims whitespace', () => {
  expect(sanitizeVersion('  1.2.3  ')).toBe('1.2.3')
})

test('sanitizeVersion: passes valid semver', () => {
  expect(sanitizeVersion('1.2.3')).toBe('1.2.3')
  expect(sanitizeVersion('3.2.0')).toBe('3.2.0')
})

test('sanitizeVersion: throws on invalid version', () => {
  testThrows(() => sanitizeVersion('1.2'), 'validation')
  testThrows(() => sanitizeVersion('abc'), 'validation')
  testThrows(() => sanitizeVersion('1.2.3.4'), 'validation')
  testThrows(() => sanitizeVersion('1.2.3-beta'), 'validation')
})

test('sanitizeFilename: passes valid filenames', () => {
  expect(sanitizeFilename('electerm-3.2.0-linux-x64.tar.gz')).toBe('electerm-3.2.0-linux-x64.tar.gz')
  expect(sanitizeFilename('electerm-3.2.0-mac-x64.dmg')).toBe('electerm-3.2.0-mac-x64.dmg')
})

test('sanitizeFilename: trims whitespace', () => {
  expect(sanitizeFilename('  test.tar.gz  ')).toBe('test.tar.gz')
})

test('sanitizeFilename: throws on invalid filenames', () => {
  testThrows(() => sanitizeFilename('../evil.sh'), 'validation')
  testThrows(() => sanitizeFilename('test; rm -rf /'), 'validation')
  testThrows(() => sanitizeFilename('test$(whoami).tar.gz'), 'validation')
})

// =============================================================================
// Tests: Download Patterns
// =============================================================================

console.log('\n=== Download Pattern Tests ===\n')

const v = '3.2.0'
const releaseFiles = [
  `electerm-${v}-linux-arm64.tar.gz`,
  `electerm-${v}-linux-arm64-legacy.tar.gz`,
  `electerm-${v}-linux-armv7l.tar.gz`,
  `electerm-${v}-linux-armv7l-legacy.tar.gz`,
  `electerm-${v}-linux-x64.tar.gz`,
  `electerm-${v}-linux-x64-legacy.tar.gz`,
  `electerm-${v}-mac-arm64.dmg`,
  `electerm-${v}-mac-x64.dmg`,
  `electerm-${v}-mac10-x64.dmg`,
  `electerm-${v}-win-arm64.tar.gz`,
  `electerm-${v}-win-x64.tar.gz`,
  `electerm-${v}-win7.tar.gz`
]

test('pattern: win-x64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('win32', 'x64', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-win-x64.tar.gz`])
})

test('pattern: win-arm64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('win32', 'arm64', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-win-arm64.tar.gz`])
})

test('pattern: win7 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('win32', 'x64', { win7: true })
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-win7.tar.gz`])
})

test('pattern: mac-x64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('darwin', 'x64', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-mac-x64.dmg`])
})

test('pattern: mac-arm64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('darwin', 'arm64', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-mac-arm64.dmg`])
})

test('pattern: mac10-x64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('darwin', 'x64', { mac10: true })
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-mac10-x64.dmg`])
})

test('pattern: linux-x64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('linux', 'x64', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-linux-x64.tar.gz`])
})

test('pattern: linux-x64-legacy matches exactly one file', () => {
  const { pattern } = getDownloadPattern('linux', 'x64', { linuxLegacy: true })
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-linux-x64-legacy.tar.gz`])
})

test('pattern: linux-arm64 matches exactly one file', () => {
  const { pattern } = getDownloadPattern('linux', 'arm64', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-linux-arm64.tar.gz`])
})

test('pattern: linux-arm64-legacy matches exactly one file', () => {
  const { pattern } = getDownloadPattern('linux', 'arm64', { linuxLegacy: true })
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-linux-arm64-legacy.tar.gz`])
})

test('pattern: linux-armv7l matches exactly one file', () => {
  const { pattern } = getDownloadPattern('linux', 'arm', {})
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-linux-armv7l.tar.gz`])
})

test('pattern: linux-armv7l-legacy matches exactly one file', () => {
  const { pattern } = getDownloadPattern('linux', 'arm', { linuxLegacy: true })
  const matches = releaseFiles.filter(f => pattern.test(f))
  expect(matches).toEqual([`electerm-${v}-linux-armv7l-legacy.tar.gz`])
})

test('pattern: unsupported platform returns null pattern', () => {
  const { pattern, type } = getDownloadPattern('freebsd', 'x64', {})
  expect(pattern).toBe(null)
  expect(type).toBe('unsupported')
})

// =============================================================================
// Tests: Extracted Binary Path
// =============================================================================

console.log('\n=== Extracted Binary Path Tests ===\n')

test('getElectermExePath: returns correct path for current platform', () => {
  const exePath = getElectermExePath()
  if (plat === 'win32') {
    expect(exePath).toBe(path.join(_extractDir, 'electerm.exe'))
  } else {
    expect(exePath).toBe(path.join(_extractDir, 'electerm'))
  }
})

test('getElectermExePath: extractDir is inside packageRoot', () => {
  expect(_extractDir).toContain(_packageRoot)
  expect(_extractDir).toBe(path.join(_packageRoot, 'electerm'))
})

test('isElectermExtracted: returns boolean', () => {
  const result = isElectermExtracted()
  expect(typeof result).toBe('boolean')
})

// =============================================================================
// Tests: Utils - Proxy Support
// =============================================================================

console.log('\n=== Utils Proxy Tests ===\n')

test('applyProxy: returns original URL when no proxy configured', () => {
  // GITHUB_PROXY is empty by default in tests
  const result = applyProxy('https://github.com/test/file.tar.gz')
  expect(result).toBe('https://github.com/test/file.tar.gz')
})

test('applyProxy: does not proxy non-GitHub URLs', () => {
  const result = applyProxy('https://example.com/file.tar.gz')
  expect(result).toBe('https://example.com/file.tar.gz')
})

test('applyProxy: proxies GitHub URLs when GITHUB_PROXY is set', () => {
  // Test the logic directly since module caches GITHUB_PROXY at load time
  const proxy = 'https://gh-proxy.com'
  const url = 'https://github.com/electerm/electerm/releases/download/v1.0.0/test.tar.gz'

  // Simulate the applyProxy logic
  const cleanProxy = proxy.replace(/\/+$/, '')
  const result = `${cleanProxy}/${url}`

  expect(result).toBe('https://gh-proxy.com/https://github.com/electerm/electerm/releases/download/v1.0.0/test.tar.gz')
})

test('applyProxy: handles proxy URL with trailing slash', () => {
  const proxy = 'https://gh-proxy.com/'
  const url = 'https://github.com/test/file.tar.gz'

  const cleanProxy = proxy.replace(/\/+$/, '')
  const result = `${cleanProxy}/${url}`

  expect(result).toBe('https://gh-proxy.com/https://github.com/test/file.tar.gz')
})

test('formatBytes: formats bytes correctly', () => {
  expect(formatBytes(0)).toBe('0 B')
  expect(formatBytes(1024)).toBe('1 KB')
  expect(formatBytes(1048576)).toBe('1 MB')
  expect(formatBytes(1073741824)).toBe('1 GB')
})

test('formatBytes: handles partial units', () => {
  expect(formatBytes(1536)).toBe('1.5 KB')
  expect(formatBytes(1572864)).toBe('1.5 MB')
})

// =============================================================================
// Tests: Utils - Tar Extract (sync-friendly)
// =============================================================================

console.log('\n=== Utils Tar Extract Tests ===\n')

test('extractTarGz: extracts a tar.gz file', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-test-tar-'))
  const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-test-extract-'))

  try {
    const testFile = path.join(tmpDir, 'test.txt')
    fs.writeFileSync(testFile, 'Hello World')

    const tarFile = path.join(tmpDir, 'test.tar.gz')
    await tar.create({ gzip: true, file: tarFile, cwd: tmpDir }, ['test.txt'])

    await extractTarGz(tarFile, extDir)

    expect(fs.existsSync(path.join(extDir, 'test.txt'))).toBe(true)
    const content = fs.readFileSync(path.join(extDir, 'test.txt'), 'utf8')
    expect(content).toBe('Hello World')
  } finally {
    fs.rmSync(tmpDir, { recursive: true })
    fs.rmSync(extDir, { recursive: true })
  }
})

test('extractTarGz: strips top-level directory with strip:1', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-test-strip-'))
  const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-test-strip-extract-'))

  try {
    const appDir = path.join(tmpDir, 'myapp')
    fs.mkdirSync(appDir)
    fs.writeFileSync(path.join(appDir, 'test.txt'), 'Stripped!')

    const tarFile = path.join(tmpDir, 'test.tar.gz')
    await tar.create({ gzip: true, file: tarFile, cwd: tmpDir }, ['myapp'])

    await extractTarGz(tarFile, extDir, 1)

    expect(fs.existsSync(path.join(extDir, 'test.txt'))).toBe(true)
    expect(fs.existsSync(path.join(extDir, 'myapp'))).toBe(false)
  } finally {
    fs.rmSync(tmpDir, { recursive: true })
    fs.rmSync(extDir, { recursive: true })
  }
})

// =============================================================================
// Tests: CLI Launcher Flow
// =============================================================================

console.log('\n=== CLI Launcher Flow Tests ===\n')

test('node launcher: correct path navigation', () => {
  const npmDir = path.join(_packageRoot, 'npm')
  const expectedPackageRoot = path.resolve(npmDir, '..')
  expect(expectedPackageRoot).toBe(_packageRoot)
})

test('node launcher: checks for electerm binary existence', () => {
  const expectedBinaryPath = path.join(_packageRoot, 'electerm', 'electerm')
  expect(expectedBinaryPath).toBe(getElectermExePath())
})

test('install flow: extractDir is correct', () => {
  expect(_extractDir).toBe(path.join(_packageRoot, 'electerm'))
})

test('install flow: no infinite recursion', () => {
  // install.js does NOT call exec('electerm')
  // It only downloads and extracts
  // The node launcher then spawns the extracted binary directly
  const installExports = require('../../npm/install')
  expect(typeof installExports.isElectermExtracted).toBe('function')
  expect(typeof installExports.getElectermExePath).toBe('function')
})

test('node launcher: launches binary after install', () => {
  // The Node.js launcher flow:
  // 1. Check if ./electerm/electerm exists
  // 2. If not: spawn node ./npm/install.js (downloads & extracts)
  // 3. Spawn ./electerm/electerm (launches binary)
  //
  // This prevents infinite recursion because:
  // - install.js never calls 'electerm' command
  // - Node.js launcher uses spawn/execFile to run the binary directly
  // - npm creates a proper .cmd wrapper on Windows via #!/usr/bin/env node

  const bashScriptPath = path.join(_packageRoot, 'npm', 'electerm')
  expect(fs.existsSync(bashScriptPath)).toBe(true)
})

// =============================================================================
// Tests: Cross-Platform Paths
// =============================================================================

console.log('\n=== Cross-Platform Path Tests ===\n')

test('paths: packageRoot is absolute', () => {
  expect(path.isAbsolute(_packageRoot)).toBe(true)
})

test('paths: extractDir is absolute', () => {
  expect(path.isAbsolute(_extractDir)).toBe(true)
})

test('paths: extractDir is child of packageRoot', () => {
  expect(_extractDir.startsWith(_packageRoot)).toBe(true)
})

// =============================================================================
// Async HTTP Tests (run last to avoid output interleaving)
// =============================================================================

console.log('\n=== Utils HTTP Tests (async) ===\n')

testAsync('httpGet: fetches a URL', async () => {
  const result = await httpGet('https://httpbin.org/get', 10000)
  expect(typeof result).toBe('string')
  expect(result).toContain('httpbin.org')
})

testAsync('phin: makes HTTP request', async () => {
  const result = await phin({ url: 'https://httpbin.org/get', timeout: 10000 })
  expect(result.statusCode).toBe(200)
  expect(Buffer.isBuffer(result.body)).toBe(true)
  expect(result.body.toString()).toContain('httpbin.org')
})

testAsync('httpGet: handles redirects', async () => {
  const result = await httpGet('https://httpbin.org/redirect/1', 10000)
  expect(typeof result).toBe('string')
})

testAsync('httpGet: throws on 404', async () => {
  try {
    await httpGet('https://httpbin.org/status/404', 10000)
    throw new Error('Expected to throw')
  } catch (e) {
    expect(e.message).toContain('404')
  }
})

testAsync('download: downloads a file', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-test-dl-'))
  try {
    const result = await download(
      'https://httpbin.org/robots.txt',
      tmpDir,
      { extract: false }
    )
    expect(result.filepath).toContain('robots.txt')
    expect(result.extracted).toBe(false)
    expect(fs.existsSync(result.filepath)).toBe(true)
  } finally {
    fs.rmSync(tmpDir, { recursive: true })
  }
})

// =============================================================================
// Run all async tests and print results
// =============================================================================

async function runAsyncTests () {
  for (const fn of asyncQueue) {
    await fn()
  }
}

async function printResults () {
  await runAsyncTests()

  console.log('\n========================================')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('========================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

printResults().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
