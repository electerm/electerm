/**
 * Unit tests for the electerm-cloud sync upload cap
 * (src/client/common/sync-payload-limit.js).
 *
 * The server refuses a payload above its cap with a 413, and that surfaces in
 * the UI as a bare HTTPError with no size and no limit. This module is what
 * turns it into a message the user can act on, so the properties that matter
 * are:
 *   - the size measured is the *wire* size (UTF-8 bytes), not the character
 *     count, because a Chinese bookmark set is ~3x longer in bytes
 *   - the boundaries are exact, so a payload at the cap is not refused early
 *     and one byte over is
 *   - an ordinary bookmark set does not warn
 *
 * Run with: node --test src/test/unit-ci/sync-payload-limit.spec.js
 */

const { describe, test, before } = require('node:test')
const assert = require('node:assert/strict')

let maxSyncPayload
let maxSyncPayloadKb
let syncWarnRatio
let payloadSize
let checkSyncPayloadSize
let tooLargeMessage
let nearLimitMessage

before(async () => {
  const mod = await import('../../client/common/sync-payload-limit.js')
  maxSyncPayload = mod.maxSyncPayload
  maxSyncPayloadKb = mod.maxSyncPayloadKb
  syncWarnRatio = mod.syncWarnRatio
  payloadSize = mod.payloadSize
  checkSyncPayloadSize = mod.checkSyncPayloadSize
  tooLargeMessage = mod.tooLargeMessage
  nearLimitMessage = mod.nearLimitMessage
})

/**
 * A payload of an exact byte length, all ASCII so bytes === characters.
 * Shaped like the real upload body (the gist wrapper electerm-sync PUTs).
 */
function asciiPayload (totalBytes) {
  const prefix = '{"description":"sync electerm data","files":{"bookmarks.json":{"content":"'
  const suffix = '"}}}'
  const fill = 'x'.repeat(totalBytes - prefix.length - suffix.length)
  return JSON.parse(prefix + fill + suffix)
}

/** The same, but the filler is CJK — 3 bytes per character on the wire. */
function cjkPayload (totalBytes) {
  const prefix = '{"description":"sync electerm data","files":{"bookmarks.json":{"content":"'
  const suffix = '"}}}'
  const chars = Math.floor((totalBytes - prefix.length - suffix.length) / 3)
  const fill = '服'.repeat(chars)
  return JSON.parse(prefix + fill + suffix)
}

describe('sync payload limit: constants', () => {
  test('the cap is 280KB, matching electerm-cloud', () => {
    // electerm-cloud/src/server/control/sync-limits.ts. The server publishes
    // this as X-Sync-Max-KB; if that ever disagrees, this is the number that
    // makes the client refuse uploads the server would have accepted.
    assert.equal(maxSyncPayloadKb, 280)
    assert.equal(maxSyncPayload, 280 * 1024)
  })

  test('the warn threshold sits below the cap', () => {
    assert.ok(syncWarnRatio > 0 && syncWarnRatio < 1)
  })
})

describe('sync payload limit: payloadSize', () => {
  test('measures wire bytes, not characters', () => {
    const obj = { title: '服务器-北京' }
    const str = JSON.stringify(obj)
    assert.equal(payloadSize(obj), Buffer.byteLength(str, 'utf8'))
    assert.ok(payloadSize(obj) > str.length)
  })

  test('counts a CJK payload at 3 bytes per character', () => {
    // 100 characters of filler, plus the ASCII wrapper
    const obj = { files: { 'bookmarks.json': { content: '服'.repeat(100) } } }
    const str = JSON.stringify(obj)
    assert.equal(payloadSize(obj), Buffer.byteLength(str, 'utf8'))
    assert.equal(payloadSize(obj), str.length + 100 * 2)
  })

  test('is exact for the generated fixtures', () => {
    assert.equal(payloadSize(asciiPayload(1024)), 1024)
    assert.equal(payloadSize(asciiPayload(maxSyncPayload)), maxSyncPayload)
  })
})

describe('sync payload limit: checkSyncPayloadSize', () => {
  test('accepts a payload comfortably under the cap', () => {
    const r = checkSyncPayloadSize(asciiPayload(1024))
    assert.equal(r.level, 'ok')
    assert.equal(r.bytes, 1024)
    assert.equal(r.kb, 1)
  })

  test('a payload exactly at the cap is accepted, not refused', () => {
    // The server refuses only when the body is *greater* than the cap, so the
    // boundary must not be off by one in the client either. It does warn,
    // because it is necessarily past the warn threshold.
    const r = checkSyncPayloadSize(asciiPayload(maxSyncPayload))
    assert.notEqual(r.level, 'over')
    assert.equal(r.level, 'warn')
    assert.equal(r.kb, maxSyncPayloadKb)
  })

  test('refuses a payload one byte over the cap', () => {
    const r = checkSyncPayloadSize(asciiPayload(maxSyncPayload + 1))
    assert.equal(r.level, 'over')
  })

  test('warns just above the warn threshold and not just below it', () => {
    const threshold = Math.floor(maxSyncPayload * syncWarnRatio)
    assert.equal(checkSyncPayloadSize(asciiPayload(threshold)).level, 'ok')
    assert.equal(checkSyncPayloadSize(asciiPayload(threshold + 1)).level, 'warn')
  })

  test('warn and over are mutually exclusive', () => {
    const warn = checkSyncPayloadSize(asciiPayload(Math.floor(maxSyncPayload * syncWarnRatio) + 1))
    const over = checkSyncPayloadSize(asciiPayload(maxSyncPayload + 1))
    assert.equal(warn.level, 'warn')
    assert.equal(over.level, 'over')
  })

  test('refuses a CJK payload that is under the cap in characters but over it in bytes', () => {
    // The whole reason payloadSize exists: a character count would let this
    // through and the server would answer 413.
    const r = checkSyncPayloadSize(cjkPayload(maxSyncPayload + 3 * 1024))
    assert.ok(r.bytes > maxSyncPayload)
    assert.equal(r.level, 'over')
  })

  test('does not warn for an ordinary bookmark set', () => {
    const bms = []
    for (let i = 0; i < 400; i++) {
      bms.push({
        id: `bm${i}`,
        title: `server-${i}`,
        host: `10.0.${i % 250}.${(i * 7) % 250}`,
        username: 'deploy',
        authType: 'password',
        password: `pw-${i.toString(36)}`,
        port: 22,
        type: 'ssh'
      })
    }
    const body = {
      description: 'sync electerm data',
      files: {
        'bookmarks.json': { content: JSON.stringify(bms) },
        'electerm-status.json': { content: '{}' }
      }
    }
    const r = checkSyncPayloadSize(body)
    assert.equal(r.level, 'ok')
    // and it is genuinely a large payload, not a trivially small one: 400
    // bookmarks is ~67KB, still well clear of the 224KB warn threshold
    assert.ok(r.bytes > 60 * 1024)
  })
})

describe('sync payload limit: messages', () => {
  test('the refusal names the size and the limit', () => {
    const msg = tooLargeMessage(350)
    assert.match(msg, /350KB/)
    assert.match(msg, /max 280KB/)
  })

  test('the warning names the size and the limit', () => {
    const msg = nearLimitMessage(240)
    assert.match(msg, /240KB/)
    assert.match(msg, /280KB/)
  })
})
