const crypto = require('node:crypto')

function createPkce (randomBytes = crypto.randomBytes) {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function exactLoopbackCallback (expected, actual) {
  try {
    const a = new URL(expected)
    const b = new URL(actual)
    return a.protocol === 'http:' && a.hostname === '127.0.0.1' &&
      b.protocol === a.protocol && b.hostname === a.hostname &&
      b.port === a.port && b.pathname === '/auth/callback' &&
      a.pathname === b.pathname
  } catch (_) {
    return false
  }
}

function safeOAuthError () {
  return 'OAuth request failed'
}

async function discoverOIDC (http, issuer, options = {}) {
  const response = await http.get(`${issuer}/.well-known/openid-configuration`, { timeout: 15000, ...options })
  const metadata = response.data
  for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'registration_endpoint', 'revocation_endpoint']) {
    if (!metadata[key]) continue
    const url = new URL(metadata[key])
    if (url.protocol !== 'https:' || url.hostname !== new URL(issuer).hostname) {
      throw new Error('OAuth endpoint rejected')
    }
  }
  return metadata
}

async function postForm (http, url, fields, options = {}) {
  const response = await http.post(url, new URLSearchParams(fields).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
    ...options
  })
  return response.data
}

function verifyIdToken (token, jwks, { issuer, audience, nonce, clock = () => Date.now() }) {
  const jwt = require('jsonwebtoken')
  const { decode, verify } = jwt
  const decoded = decode(token, { complete: true })
  if (!decoded || !decoded.header || !decoded.header.kid) throw new Error('Invalid identity token')
  const jwk = (jwks.keys || []).find(key => key.kid === decoded.header.kid)
  if (!jwk) throw new Error('Untrusted identity token')
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  const claims = verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer,
    audience,
    clockTimestamp: Math.floor(clock() / 1000)
  })
  if (claims.nonce !== nonce) throw new Error('Identity token nonce mismatch')
  return claims
}

module.exports = {
  createPkce,
  exactLoopbackCallback,
  safeOAuthError,
  discoverOIDC,
  postForm,
  verifyIdToken
}
