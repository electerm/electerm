/**
 * Unit tests for the sync-data cipher (src/app/lib/enc.js).
 *
 * This is the client-side encryption used for sync passwords (bookmarks /
 * profiles payloads), so the properties that matter are:
 *   - round trip works for the async entry points the sync store calls
 *   - ciphertext never contains the plaintext and carries a fresh IV/salt
 *   - a wrong password fails instead of returning garbage
 *   - tampered ciphertext fails (GCM auth tag) instead of decrypting
 *   - the legacy aes-192-cbc format (pre-GCM sync data) still decrypts
 *
 * Run with: node --test src/test/unit-ci/sync-enc.spec.js
 */

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const {
  encrypt,
  decrypt,
  encryptAsync,
  decryptAsync
} = require('../../../src/app/lib/enc')

const pass = 'correct horse battery staple'
const secret = JSON.stringify([{ host: '1.2.3.4', password: 'hunter2' }])

describe('sync enc: gcm format', () => {
  test('encryptAsync produces gcm:iv:salt:authtag:ciphertext', async () => {
    const out = await encryptAsync(secret, pass)
    const parts = out.split(':')
    assert.strictEqual(parts.length, 5)
    assert.strictEqual(parts[0], 'gcm')
    // iv 12 bytes, salt 16 bytes, authTag 16 bytes, all hex
    assert.strictEqual(parts[1].length, 24)
    assert.strictEqual(parts[2].length, 32)
    assert.strictEqual(parts[3].length, 32)
    assert.match(parts[4], /^[0-9a-f]+$/)
  })

  test('ciphertext does not leak plaintext', async () => {
    const out = await encryptAsync(secret, pass)
    assert.ok(!out.includes('hunter2'))
    assert.ok(!out.includes('1.2.3.4'))
  })

  test('fresh iv and salt per encryption (no deterministic output)', async () => {
    const a = await encryptAsync(secret, pass)
    const b = await encryptAsync(secret, pass)
    assert.notStrictEqual(a, b)
    const [iva, salta] = a.split(':').slice(1, 3)
    const [ivb, saltb] = b.split(':').slice(1, 3)
    assert.notStrictEqual(iva, ivb)
    assert.notStrictEqual(salta, saltb)
  })
})

describe('sync enc: round trip', () => {
  test('async round trip (what the sync store uses)', async () => {
    const enc = await encryptAsync(secret, pass)
    assert.strictEqual(await decryptAsync(enc, pass), secret)
  })

  test('sync round trip', () => {
    const enc = encrypt(secret, pass)
    assert.strictEqual(decrypt(enc, pass), secret)
  })

  test('empty string payload round trips', async () => {
    const enc = await encryptAsync('', pass)
    assert.strictEqual(await decryptAsync(enc, pass), '')
  })

  test('non-ascii payload round trips', async () => {
    const s = '主机密码 hunter2 日本語'
    const enc = await encryptAsync(s, pass)
    assert.strictEqual(await decryptAsync(enc, pass), s)
  })
})

describe('sync enc: failure modes', () => {
  test('wrong password throws instead of returning garbage', async () => {
    const enc = await encryptAsync(secret, pass)
    await assert.rejects(
      () => decryptAsync(enc, 'wrong password'),
      /Unsupported state or unable to authenticate data/
    )
  })

  test('tampered ciphertext throws (gcm auth tag)', async () => {
    const enc = await encryptAsync(secret, pass)
    const parts = enc.split(':')
    // flip one hex nibble of the ciphertext body
    const body = parts[4]
    const flipped = (body[0] === 'a' ? 'b' : 'a') + body.slice(1)
    const tampered = [...parts.slice(0, 4), flipped].join(':')
    await assert.rejects(() => decryptAsync(tampered, pass))
  })

  test('tampered auth tag throws', async () => {
    const cipher = await encryptAsync(secret, pass)
    const parts = cipher.split(':')
    const tag = parts[3]
    const flipped = (tag[0] === 'a' ? 'b' : 'a') + tag.slice(1)
    const tampered = [...parts.slice(0, 3), flipped, parts[4]].join(':')
    await assert.rejects(() => decryptAsync(tampered, pass))
  })

  test('truncated gcm payload throws', async () => {
    await assert.rejects(() => decryptAsync('gcm:aa:bb', pass))
  })
})

describe('sync enc: legacy format', () => {
  // Records written before the gcm format switch: aes-192-cbc, static
  // zero IV, static 'salt' salt, bare hex (no marker). decrypt must keep
  // reading them, otherwise every pre-existing sync payload is lost.
  function legacyEncrypt (str, password) {
    const key = crypto.scryptSync(password, 'salt', 24)
    const cipher = crypto.createCipheriv('aes-192-cbc', key, Buffer.alloc(16, 0))
    let out = cipher.update(str, 'utf8', 'hex')
    out += cipher.final('hex')
    return out
  }

  test('legacy ciphertext still decrypts (async and sync)', async () => {
    const legacy = legacyEncrypt(secret, pass)
    assert.ok(!legacy.startsWith('gcm:'))
    assert.strictEqual(await decryptAsync(legacy, pass), secret)
    assert.strictEqual(decrypt(legacy, pass), secret)
  })

  test('legacy ciphertext with wrong password throws', async () => {
    const legacy = legacyEncrypt(secret, pass)
    await assert.rejects(() => decryptAsync(legacy, 'nope'))
  })
})
