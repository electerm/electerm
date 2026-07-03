const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

// Server-side (CJS) — used by zmodem, xmodem, trzsz
const sanitizeApp = require('../../src/app/common/sanitize-filename')

function runTests (getFn) {
  it('preserves leading dot (hidden file names)', () => {
    const s = getFn()
    assert.strictEqual(s('.env'), '.env')
    assert.strictEqual(s('.gitignore'), '.gitignore')
    assert.strictEqual(s('.htaccess'), '.htaccess')
    assert.strictEqual(s('.bashrc'), '.bashrc')
    assert.strictEqual(s('.config'), '.config')
  })

  it('preserves double-leading dots in filenames', () => {
    assert.strictEqual(getFn()('..hidden'), '..hidden')
  })

  it('rejects ".." and "..." as all-trailing-dots filenames', () => {
    // Both are all dots -> trailing strip produces empty -> fallback 'unnamed'
    const s = getFn()
    assert.strictEqual(s('..'), 'unnamed')
    assert.strictEqual(s('...'), 'unnamed')
  })

  it('preserves leading dot with extension', () => {
    const s = getFn()
    assert.strictEqual(s('.env.production'), '.env.production')
    assert.strictEqual(s('.env.backup'), '.env.backup')
    assert.strictEqual(s('.npmrc'), '.npmrc')
  })

  it('strips trailing dots and spaces', () => {
    const s = getFn()
    assert.strictEqual(s('file...'), 'file')
    assert.strictEqual(s('file.'), 'file')
    assert.strictEqual(s('file   '), 'file')
    assert.strictEqual(s('file.   '), 'file')
  })

  it('strips leading spaces (not dots)', () => {
    const s = getFn()
    assert.strictEqual(s('  file.txt'), 'file.txt')
    assert.strictEqual(s('  .env'), '.env')
    assert.strictEqual(s('  normal'), 'normal')
  })

  it('handles combined leading space + trailing dots', () => {
    const s = getFn()
    assert.strictEqual(s('  file...  '), 'file')
    assert.strictEqual(s('  .env.  '), '.env')
  })

  it('replaces illegal characters with underscore', () => {
    const s = getFn()
    assert.strictEqual(s('file<name>.txt'), 'file_name_.txt')
    assert.strictEqual(s('a:b.txt'), 'a_b.txt')
    assert.strictEqual(s('file?.txt'), 'file_.txt')
    assert.strictEqual(s('a|b.txt'), 'a_b.txt')
  })

  it('handles reserved Windows device names', () => {
    const s = getFn()
    assert.strictEqual(s('CON'), 'CON_')
    assert.strictEqual(s('PRN'), 'PRN_')
    assert.strictEqual(s('AUX'), 'AUX_')
    assert.strictEqual(s('NUL'), 'NUL_')
    assert.strictEqual(s('COM1'), 'COM1_')
    assert.strictEqual(s('LPT9'), 'LPT9_')
  })

  it('does not touch normal filenames', () => {
    const s = getFn()
    assert.strictEqual(s('hello.txt'), 'hello.txt')
    assert.strictEqual(s('document.pdf'), 'document.pdf')
    assert.strictEqual(s('README.md'), 'README.md')
    assert.strictEqual(s('index.html'), 'index.html')
  })

  it('returns "unnamed" for empty/invalid input', () => {
    const s = getFn()
    assert.strictEqual(s(''), 'unnamed')
    assert.strictEqual(s(null), 'unnamed')
    assert.strictEqual(s(undefined), 'unnamed')
    assert.strictEqual(s(123), 'unnamed')
  })

  it('strips control characters', () => {
    const s = getFn()
    assert.strictEqual(s('file\x00.txt'), 'file_.txt')
    assert.strictEqual(s('test\x01file.txt'), 'test_file.txt')
    // Tab (0x09) is a control char, replaced before space strip
    assert.strictEqual(s('\tfile.txt'), '_file.txt')
  })
}

describe('sanitizeFilename', () => {
  // Client-side (ESM) — used by SFTP drop, session.jsx — loaded async
  let sanitizeClient
  before(async () => {
    const mod = await import('../../src/client/common/sanitize-filename.js')
    sanitizeClient = mod.default
  })

  describe('server (CJS) — zmodem/xmodem/trzsz', () => {
    runTests(() => sanitizeApp)
  })

  describe('client (ESM) — SFTP drop/session.jsx', () => {
    runTests(() => sanitizeClient)
  })
})
