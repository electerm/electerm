const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const jwt = require('jsonwebtoken')
const { createChatGPTAuth, CHATGPT_ISSUER, CHATGPT_SCOPES } = require('../../app/lib/ai-chatgpt-auth')

describe('ChatGPT OAuth sign-in', () => {
  it('keeps an account connected but blocks inference when the direct-use grant is missing', async () => {
    const auth = createChatGPTAuth({
      storage: {
        async get () {
          return { accessToken: 'synthetic-token', expiresAt: Date.now() + 600000, planUsageEnabled: false }
        }
      },
      http: {}
    })
    const status = await auth.status()
    assert.equal(status.configured, true)
    assert.equal(status.planUsageEnabled, false)
    await assert.rejects(auth.getAccessToken(), /permission is missing/i)
  })

  it('uses dynamic-agent registration once, validates the ID token, and returns safe status', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const publicJwk = publicKey.export({ format: 'jwk' })
    Object.assign(publicJwk, { kid: 'test-key', alg: 'RS256', use: 'sig' })
    const storage = {
      record: null,
      clientId: null,
      accountId: null,
      async get () { return this.record },
      async set (_, record) { this.record = record },
      async delete () { this.record = null },
      async getOrCreateHostId () { return 'stable-host-id' },
      async getClientId () { return this.clientId },
      async setClientId (_, value) { this.clientId = value },
      async getAccountId () { return this.accountId },
      async setAccountId (_, value) { this.accountId = value }
    }
    let callbackResolve
    let authUrl
    let tokenRequest
    let currentAccountId = 'account-1'
    const listenerFactory = () => {
      const callback = new Promise(resolve => { callbackResolve = resolve })
      return {
        ready: Promise.resolve({ redirectUri: 'http://127.0.0.1:1455/auth/callback', callback }),
        close () {},
        cancel () {}
      }
    }
    const http = {
      async get (url) {
        if (url.endsWith('openid-configuration')) {
          return {
            data: {
              authorization_endpoint: `${CHATGPT_ISSUER}/oauth/authorize`,
              token_endpoint: `${CHATGPT_ISSUER}/oauth/token`,
              jwks_uri: `${CHATGPT_ISSUER}/oauth/jwks`
            }
          }
        }
        return { data: { keys: [publicJwk] } }
      },
      async post (url, body) {
        if (url.endsWith('/oauth/token')) {
          tokenRequest = new URLSearchParams(body)
          const claims = {
            iss: CHATGPT_ISSUER,
            aud: 'issued-client',
            sub: currentAccountId,
            email: 'user@example.test',
            nonce: new URL(authUrl).searchParams.get('nonce'),
            scope: CHATGPT_SCOPES,
            exp: Math.floor(Date.now() / 1000) + 300
          }
          const token = jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: 'test-key' })
          return { data: { access_token: 'access-secret', refresh_token: 'refresh-secret', id_token: token, expires_in: 300, scope: CHATGPT_SCOPES } }
        }
        throw new Error(`Unexpected endpoint ${url}`)
      }
    }
    const auth = createChatGPTAuth({
      storage,
      http,
      listenerFactory,
      openExternal: async url => {
        authUrl = url
        const target = new URL('http://127.0.0.1:1455/auth/callback')
        target.searchParams.set('state', new URL(url).searchParams.get('state'))
        target.searchParams.set('code', 'one-time-code')
        if (new URL(url).searchParams.get('client_id') === 'dynamic_agent_client') {
          target.searchParams.set('client_id', 'issued-client')
        }
        callbackResolve(target.toString())
      }
    })
    const status = await auth.signIn()
    const authorize = new URL(authUrl)
    assert.equal(authorize.searchParams.get('client_id'), 'dynamic_agent_client')
    assert.equal(authorize.searchParams.get('agent_name_hint'), 'electerm')
    assert.equal(authorize.searchParams.get('ext_agent_host_id'), 'stable-host-id')
    assert.equal(authorize.searchParams.get('scope'), CHATGPT_SCOPES)
    assert.equal(authorize.searchParams.get('resource'), 'https://api.openai.com/v1')
    assert.equal(tokenRequest.get('client_id'), 'issued-client')
    assert.equal(tokenRequest.get('resource'), 'https://api.openai.com/v1')
    assert.equal(status.planUsageEnabled, true)
    assert.equal(JSON.stringify(status).includes('access-secret'), false)
    assert.equal(storage.record.refreshToken, 'refresh-secret')
    assert.equal(storage.clientId, 'issued-client')
    assert.equal(storage.accountId, 'account-1')

    await auth.signOut()
    await auth.signIn()
    const reauthorization = new URL(authUrl)
    assert.equal(reauthorization.searchParams.get('client_id'), 'issued-client')
    assert.equal(reauthorization.searchParams.has('agent_name_hint'), false)
    assert.equal(tokenRequest.get('client_id'), 'issued-client')
    await auth.signOut()
    currentAccountId = 'different-account'
    await assert.rejects(auth.signIn(), /OAuth request failed/)
    assert.equal(storage.record, null)
  })

  it('serializes token refresh and persists a rotated refresh token', async () => {
    let tokenRequests = 0
    const storage = {
      record: { clientId: 'client', accessToken: 'expired', refreshToken: 'old-refresh', expiresAt: 0, planUsageEnabled: true },
      async get () { return this.record },
      async set (_, record) { this.record = record },
      async delete () { this.record = null }
    }
    const http = {
      async get (url) {
        return {
          data: {
            authorization_endpoint: `${CHATGPT_ISSUER}/oauth/authorize`,
            token_endpoint: `${CHATGPT_ISSUER}/oauth/token`,
            jwks_uri: `${CHATGPT_ISSUER}/oauth/jwks`
          }
        }
      },
      async post () {
        tokenRequests++
        await new Promise(resolve => setTimeout(resolve, 2))
        return { data: { access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 600 } }
      }
    }
    const auth = createChatGPTAuth({ storage, http })
    const [first, second] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()])
    assert.equal(first, 'new-access')
    assert.equal(second, 'new-access')
    assert.equal(tokenRequests, 1)
    assert.equal(storage.record.refreshToken, 'rotated-refresh')
  })
})
