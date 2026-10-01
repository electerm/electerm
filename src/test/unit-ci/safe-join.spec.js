const { before, describe, it } = require('node:test')
const assert = require('node:assert/strict')

// Names a hostile SFTP server can put in a READDIR entry, plus benign ones.
// `resolve` returns an absolute name unchanged and walks up on a bare `..`, so
// anything with a separator or that is exactly `..` is the attack surface.
const NAMES = [
  // relative traversal
  '../../outside.txt',
  '../../../../etc/cron.d/evil',
  '..\\..\\windows\\system32\\evil.dll',
  'a/../../b',
  // absolute override
  '/tmp/abs-escape.sh',
  '/etc/passwd',
  'C:\\Users\\victim\\.ssh\\authorized_keys',
  '\\\\server\\share\\evil',
  // drive-prefixed with NO separator — `resolve` discards the base for these
  // too, which is why a bare "does it contain a separator?" check is not enough
  'C:x',
  'C:..',
  'z:anything',
  'C:/etc/passwd',
  // bare dot components
  '..',
  '.',
  '...',
  '../',
  // separator smuggling
  'a/b.txt',
  'a\\b.txt',
  '.._..',
  // benign names that must survive untouched
  'normal.txt',
  'archive.tar.gz',
  '.env',
  '.gitignore',
  '..hidden',
  'file with spaces.txt',
  'ünïcödé.txt',
  'emoji-🦄.png',
  'CON',
  'file.',
  'file...',
  '  leading-space.txt',
  'file<name>.txt',
  'a:b.txt',
  'x'.repeat(400),
  // not strings
  '',
  null,
  undefined,
  123,
  {}
]

const BASES = [
  '/uploads/safe',
  '/uploads/safe/',
  '/',
  '',
  '/a',
  'C:\\Users\\me',
  'C:\\',
  'C:',
  '\\\\wsl$\\Ubuntu',
  '\\\\wsl$\\Ubuntu\\',
  '\\\\server\\share',
  'relative/base'
]

const SEPARATORS = /[/\\]/

let safeJoin

before(async () => {
  const mod = await import('../../../src/client/common/safe-join.js')
  safeJoin = mod.default
})

describe('safeJoin', () => {
  it('is a function', () => {
    assert.strictEqual(typeof safeJoin, 'function')
  })

  // The property that actually matters: whatever the name, the joined path is
  // the base plus a single trailing component, with no `..`/`.` segment left in
  // it. A test that reimplemented the helper's own check would prove nothing,
  // so this walks the result as a path instead. Calling it for every pair also
  // pins the other half of the contract: safeJoin never throws, it always
  // returns a usable path — a bad entry in a listing must not break a drop.
  it('never produces a path that escapes the base, for any base x name pair', () => {
    for (const base of BASES) {
      for (const name of NAMES) {
        const result = safeJoin(base, name)
        const segments = result.split(SEPARATORS)
        assert.ok(
          !segments.includes('..') && !segments.includes('.'),
          `safeJoin(${JSON.stringify(base)}, ${JSON.stringify(name)}) = ` +
          `${JSON.stringify(result)} contains a traversal segment`
        )
        if (base) {
          assert.ok(
            result.startsWith(base),
            `safeJoin(${JSON.stringify(base)}, ${JSON.stringify(name)}) = ` +
            `${JSON.stringify(result)} is not under the base`
          )
        }
      }
    }
  })

  it('strips relative traversal out of the name', () => {
    assert.strictEqual(safeJoin('/uploads/safe', '../../outside.txt'), '/uploads/safe/.._.._outside.txt')
    assert.strictEqual(
      safeJoin('/uploads/safe', '../../../../etc/cron.d/evil'),
      '/uploads/safe/.._.._.._.._etc_cron.d_evil'
    )
  })

  it('does not let an absolute name discard the base', () => {
    assert.strictEqual(safeJoin('/uploads/safe', '/tmp/abs-escape.sh'), '/uploads/safe/_tmp_abs-escape.sh')
    assert.strictEqual(safeJoin('/uploads/safe', '/etc/passwd'), '/uploads/safe/_etc_passwd')
  })

  it('does not let a bare ".." walk up one level', () => {
    assert.strictEqual(safeJoin('/uploads/safe', '..'), '/uploads/safe/unnamed')
    assert.strictEqual(safeJoin('/uploads/safe', '.'), '/uploads/safe/unnamed')
  })

  it('does not let a drive-prefixed name discard the base', () => {
    // These contain no path separator, so a separator-only guard would let them
    // through — `resolve('/uploads/safe', 'C:x')` returns `'C:x'`.
    assert.strictEqual(safeJoin('/uploads/safe', 'C:x'), '/uploads/safe/C_x')
    assert.strictEqual(safeJoin('/uploads/safe', 'z:anything'), '/uploads/safe/z_anything')
  })

  it('leaves ordinary names alone', () => {
    assert.strictEqual(safeJoin('/uploads/safe', 'normal.txt'), '/uploads/safe/normal.txt')
    assert.strictEqual(safeJoin('/uploads/safe/', 'normal.txt'), '/uploads/safe/normal.txt')
    assert.strictEqual(safeJoin('/', 'normal.txt'), '/normal.txt')
  })

  it('keeps hidden-file names', () => {
    assert.strictEqual(safeJoin('/uploads/safe', '.env'), '/uploads/safe/.env')
    assert.strictEqual(safeJoin('/uploads/safe', '..hidden'), '/uploads/safe/..hidden')
  })

  it('honours a Windows base separator', () => {
    assert.strictEqual(safeJoin('C:\\Users\\me', 'normal.txt'), 'C:\\Users\\me\\normal.txt')
    assert.strictEqual(safeJoin('C:\\Users\\me', '..\\..\\evil.txt'), 'C:\\Users\\me\\.._.._evil.txt')
  })

  it('handles a WSL distro root base', () => {
    assert.strictEqual(safeJoin('\\\\wsl$\\Ubuntu', '../../evil.txt'), '\\\\wsl$\\Ubuntu\\.._.._evil.txt')
  })

  it('falls back to "unnamed" for a missing name', () => {
    assert.strictEqual(safeJoin('/uploads/safe', undefined), '/uploads/safe/unnamed')
    assert.strictEqual(safeJoin('/uploads/safe', null), '/uploads/safe/unnamed')
  })

  // Pins the deliberate cost of reusing the cross-platform sanitizer: names that
  // are perfectly legal on Linux are rewritten, because electerm does not know
  // the target's OS and every other transfer path sanitizes the same way. If
  // this ever becomes a problem, the fix is a separate validator that only
  // rejects escaping names — not a looser sanitizer here.
  it('rewrites names that are legal on Linux but not on Windows', () => {
    assert.strictEqual(safeJoin('/uploads/safe', 'report:2024.txt'), '/uploads/safe/report_2024.txt')
    assert.strictEqual(safeJoin('/uploads/safe', 'what?.txt'), '/uploads/safe/what_.txt')
    assert.strictEqual(safeJoin('/uploads/safe', 'trailing.'), '/uploads/safe/trailing')
    assert.strictEqual(safeJoin('/uploads/safe', 'CON'), '/uploads/safe/CON_')
  })

  it('tolerates a non-string base', () => {
    assert.doesNotThrow(() => safeJoin(undefined, 'a.txt'))
  })
})
