// resolve.spec.js
const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

let resolve

describe('resolve', () => {
  test('setup: import ESM module', async () => {
    const mod = await import('../../src/client/common/resolve.js')
    resolve = mod.default
  })

  // ── Unix paths ──────────────────────────────────────────────

  test('unix: append name to path', () => {
    assert.strictEqual(resolve('/foo/bar', 'baz'), '/foo/bar/baz')
  })

  test('unix: append name to path with trailing slash', () => {
    assert.strictEqual(resolve('/foo/bar/', 'baz'), '/foo/bar/baz')
  })

  test('unix: go up one level', () => {
    assert.strictEqual(resolve('/foo/bar', '..'), '/foo')
  })

  test('unix: go up to root', () => {
    assert.strictEqual(resolve('/foo', '..'), '/')
  })

  test('unix: go up from root stays at root', () => {
    assert.strictEqual(resolve('/', '..'), '/')
  })

  test('unix: append name at root', () => {
    assert.strictEqual(resolve('/', 'foo'), '/foo')
  })

  // ── Windows paths ───────────────────────────────────────────

  test('win: append name to drive path', () => {
    assert.strictEqual(resolve('C:\\foo\\bar', 'baz'), 'C:\\foo\\bar\\baz')
  })

  test('win: append name to drive path with trailing slash', () => {
    assert.strictEqual(resolve('C:\\foo\\bar\\', 'baz'), 'C:\\foo\\bar\\baz')
  })

  test('win: go up one level on drive', () => {
    assert.strictEqual(resolve('C:\\foo\\bar', '..'), 'C:\\foo')
  })

  test('win: go up to drive root', () => {
    assert.strictEqual(resolve('C:\\foo', '..'), 'C:')
  })

  test('win: go up from drive root returns /', () => {
    assert.strictEqual(resolve('C:\\', '..'), '/')
  })

  test('win: append name to drive root', () => {
    assert.strictEqual(resolve('C:\\', 'foo'), 'C:\\foo')
  })

  test('win: append name to bare drive', () => {
    assert.strictEqual(resolve('C:', 'foo'), 'C:\\foo')
  })

  // ── Absolute paths in nameOrDot ─────────────────────────────

  test('abs: drive path from root', () => {
    assert.strictEqual(resolve('/', 'C:\\'), 'C:\\')
  })

  test('abs: bare drive from root', () => {
    assert.strictEqual(resolve('/', 'C:'), 'C:')
  })

  test('abs: drive path from another path', () => {
    assert.strictEqual(resolve('/foo', 'C:\\bar'), 'C:\\bar')
  })

  test('abs: unix path from win path', () => {
    assert.strictEqual(resolve('C:\\foo', '/bar'), '/bar')
  })

  test('abs: unix path from root', () => {
    assert.strictEqual(resolve('/', '/foo'), '/foo')
  })

  // ── Edge cases ──────────────────────────────────────────────

  test('edge: append to drive root', () => {
    assert.strictEqual(resolve('C:\\', 'foo'), 'C:\\foo')
  })

  test('edge: go up from D: root returns /', () => {
    assert.strictEqual(resolve('D:\\', '..'), '/')
  })

  // ── WSL paths (wsl.localhost) ───────────────────────────────

  test('wsl: enter distro from root', () => {
    assert.strictEqual(resolve('/', '\\\\wsl.localhost\\Ubuntu'), '\\\\wsl.localhost\\Ubuntu')
  })

  test('wsl: go up from distro root returns /', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu', '..'), '/')
  })

  test('wsl: go up from distro root with trailing slash returns /', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu\\', '..'), '/')
  })

  test('wsl: append child to distro root', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu', 'home'), '\\\\wsl.localhost\\Ubuntu\\home')
  })

  test('wsl: go up from child returns distro root', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu\\home', '..'), '\\\\wsl.localhost\\Ubuntu')
  })

  test('wsl: multi-level up', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu\\home\\user', '..'), '\\\\wsl.localhost\\Ubuntu\\home')
  })

  test('wsl: append in subdirectory', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu\\home', 'user'), '\\\\wsl.localhost\\Ubuntu\\home\\user')
  })

  test('wsl: append in subdirectory with trailing slash', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu\\home\\', 'user'), '\\\\wsl.localhost\\Ubuntu\\home\\user')
  })

  // ── WSL paths (wsl$) ───────────────────────────────────────

  test('wsl$: go up from distro root returns /', () => {
    assert.strictEqual(resolve('\\\\wsl$\\Ubuntu', '..'), '/')
  })

  test('wsl$: append child to distro root', () => {
    assert.strictEqual(resolve('\\\\wsl$\\Ubuntu', 'home'), '\\\\wsl$\\Ubuntu\\home')
  })

  // ── WSL cross-path switching ────────────────────────────────

  test('wsl: switch to win drive from wsl', () => {
    assert.strictEqual(resolve('\\\\wsl.localhost\\Ubuntu', 'C:\\foo'), 'C:\\foo')
  })

  test('wsl: switch from win drive to wsl', () => {
    assert.strictEqual(resolve('C:\\foo', '\\\\wsl.localhost\\Ubuntu'), '\\\\wsl.localhost\\Ubuntu')
  })
})
