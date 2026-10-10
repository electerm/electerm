const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const jwt = require('jsonwebtoken')
const {
  createPkce,
  safeOAuthError,
  exactLoopbackCallback,
  verifyIdToken
} = require('../../app/lib/ai-subscription-oauth')

describe('AI subscription OAuth helpers', () => {
  it('creates an S256 challenge from the verifier', () => {
    const { verifier, challenge } = createPkce(() => Buffer.alloc(32, 7))
    assert.equal(verifier, Buffer.alloc(32, 7).toString('base64url'))
    assert.notEqual(challenge, verifier)
    assert.match(challenge, /^[A-Za-z0-9_-]+$/)
  })

  it('accepts only the exact loopback callback route and origin', () => {
    const expected = 'http://127.0.0.1:1455/auth/callback'
    assert.equal(exactLoopbackCallback(expected, expected), true)
    assert.equal(exactLoopbackCallback(expected, 'http://localhost:1455/auth/callback'), false)
    assert.equal(exactLoopbackCallback(expected, 'http://127.0.0.1:1455/other'), false)
  })

  it('never exposes OAuth response bodies or credentials in user-safe errors', () => {
    assert.equal(safeOAuthError(new Error('bad token secret response body')), 'OAuth request failed')
  })

  it('rejects ID tokens with an untrusted issuer, audience, nonce, or expiry', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'key-1' })
    const now = 1000000
    const token = claims => jwt.sign({
      iss: 'https://issuer.test',
      aud: 'client-1',
      nonce: 'nonce-1',
      exp: Math.floor(now / 1000) + 60,
      ...claims
    }, privateKey, { algorithm: 'RS256', keyid: 'key-1' })
    const verify = (claims, params = {}) => verifyIdToken(token(claims), { keys: [jwk] }, {
      issuer: 'https://issuer.test',
      audience: 'client-1',
      nonce: 'nonce-1',
      clock: () => now,
      ...params
    })
    assert.throws(() => verify({ iss: 'https://attacker.test' }))
    assert.throws(() => verify({ aud: 'other-client' }))
    assert.throws(() => verify({ nonce: 'other-nonce' }))
    assert.throws(() => verify({ exp: 1 }))
  })
})
