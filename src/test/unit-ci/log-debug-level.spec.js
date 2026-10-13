/**
 * Test: the `debug` setting has to move the log *level*, not just the ssh2 flag.
 *
 * session-ssh.js hands ssh2 `connectOptions.debug = log.log` (ssh2 then writes
 * its whole protocol trace through that function), but a packaged build runs
 * the file/console transports at `warn` -- and log.log is level `info`. So the
 * trace was filtered out before it could be written: the "old switch / router
 * will not connect" reports arrived with `connection lost before handshake`
 * (or a kex/cipher failure) and nothing in
 * ~/.config/electerm/logs/main.log to say how far the handshake got.
 *
 * Pins, in order:
 *   1. the packaged default still drops an info-level line (no accidental
 *      verbose-by-default release)
 *   2. debug mode lets it through, and tells forked children to do the same
 *      via ELECTERM_DEBUG (../server/child-process.js reads it)
 *   3. switching debug off restores the packaged level
 *   4. dev is never filtered
 *
 * setDebugMode's second argument is the dev flag, injected because
 * runtime-constants cannot be loaded with NODE_ENV=production outside a
 * packaged app (its package.json lives next to app/, not next to src/app).
 */

process.env.NODE_ENV = 'development'
delete process.env.ELECTERM_DEBUG

const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const log = require('../../app/common/log')

const dir = mkdtempSync(join(tmpdir(), 'electerm-log-level-'))
const logFile = join(dir, 'main.log')
// never touch the developer's real ~/.config/electerm/logs/main.log
log.transports.file.resolvePath = () => logFile

const written = () => {
  try {
    return readFileSync(logFile, 'utf8')
  } catch (_) {
    return ''
  }
}

// the packaged app: what a release build runs
const PACKAGED = false

describe('debug setting controls the log level', () => {
  before(() => {
    rmSync(logFile, { force: true })
  })

  after(() => {
    log.setDebugMode(false)
    rmSync(dir, { recursive: true, force: true })
  })

  test('packaged default drops the ssh2 protocol trace', () => {
    log.setDebugMode(false, PACKAGED)
    assert.equal(log.transports.file.level, 'warn')
    assert.equal(log.transports.console.level, 'warn')
    // exactly what ssh2 does with connectOptions.debug
    log.log('Local ident: SSH-2.0-ssh2js')
    assert.ok(
      !written().includes('Local ident'),
      'an info line must not reach the packaged log'
    )
  })

  test('debug mode lets the trace through and is inherited by the child', () => {
    log.setDebugMode(true, PACKAGED)
    assert.equal(log.transports.file.level, 'debug')
    assert.equal(log.transports.console.level, 'debug')
    assert.equal(
      process.env.ELECTERM_DEBUG,
      '1',
      'the forked server process opens its level from this env var'
    )
    log.log('Local ident: SSH-2.0-ssh2js')
    log.log('Remote ident: SSH-2.0-Huawei')
    log.debug('server runs on 127.0.0.1')
    const text = written()
    assert.ok(text.includes('Local ident'), 'the trace must reach the log')
    assert.ok(text.includes('Remote ident'), 'the server banner must be visible')
    assert.ok(text.includes('server runs on'), 'log.debug lines must come through')
  })

  test('switching debug off restores the packaged level', () => {
    log.setDebugMode(false, PACKAGED)
    assert.equal(log.transports.file.level, 'warn')
    assert.equal(process.env.ELECTERM_DEBUG, '')
    const before = written()
    log.log('Local ident: after switching off')
    assert.equal(written(), before)
  })

  test('dev is never filtered', () => {
    log.setDebugMode(false, true)
    assert.equal(log.transports.file.level, 'silly')
    assert.equal(log.transports.console.level, 'silly')
    assert.equal(log.isDebugMode(), true)
  })

  test('the child agrees with the parent through ELECTERM_DEBUG', () => {
    log.setDebugMode(false, PACKAGED)
    assert.equal(log.isDebugMode(PACKAGED), false)
    process.env.ELECTERM_DEBUG = '1'
    assert.equal(log.isDebugMode(PACKAGED), true)
    process.env.ELECTERM_DEBUG = ''
    assert.equal(log.isDebugMode(PACKAGED), false)
  })
})
