const http = require('node:http')
const crypto = require('node:crypto')
const {
  createPkce,
  discoverOIDC,
  exactLoopbackCallback,
  postForm,
  verifyIdToken,
  safeOAuthError
} = require('./ai-subscription-oauth')

const ISSUER = 'https://auth.openai.com'
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
const RESOURCE = 'https://api.openai.com/v1'
const DYNAMIC_CLIENT_ID = 'dynamic_agent_client'
const safeStatus = record => ({
  supported: process.platform === 'win32',
  configured: !!record,
  planUsageEnabled: !!(record && record.planUsageEnabled),
  hint: record ? (record.planUsageEnabled ? 'ChatGPT connected' : 'Connected, but plan usage permission is missing') : ''
})

function createCallbackListener (timeoutMs = 5 * 60 * 1000) {
  let server
  let timer
  let resolveCallback
  let rejectCallback
  const callback = new Promise((resolve, reject) => {
    resolveCallback = resolve
    rejectCallback = reject
  })
  callback.catch(() => {})
  const ready = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const target = new URL(req.url, `http://127.0.0.1:${server.address().port}`)
      if (target.pathname !== '/auth/callback') {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Sign-in complete. You may close this window.')
      resolveCallback(target.toString())
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const redirectUri = `http://127.0.0.1:${server.address().port}/auth/callback`
      timer = setTimeout(() => rejectCallback(new Error('OAuth callback timed out')), timeoutMs)
      resolve({ redirectUri, callback })
    })
  })
  return {
    ready,
    close () {
      clearTimeout(timer)
      server && server.close()
    },
    cancel () {
      clearTimeout(timer)
      rejectCallback(new Error('Sign-in cancelled'))
      server && server.close()
    }
  }
}

function createChatGPTAuth ({ storage, http: client = require('axios'), openExternal, listenerFactory = createCallbackListener, clock = Date.now, random = crypto.randomBytes }) {
  let pending
  let refreshPromise
  let authVersion = 0

  async function getAccessToken () {
    const record = await storage.get('chatgpt')
    if (!record) throw new Error('ChatGPT is not connected')
    if (!record.planUsageEnabled) throw new Error('ChatGPT plan usage permission is missing. Reconnect and allow chatgpt.tokens.use.direct.')
    if (record && record.accessToken && record.expiresAt > clock() + 60000) return record.accessToken
    if (!record.refreshToken) throw new Error('ChatGPT session expired. Reconnect ChatGPT.')
    if (!refreshPromise) {
      const version = authVersion
      refreshPromise = (async () => {
        const metadata = await discoverOIDC(client, ISSUER)
        const tokens = await postForm(client, metadata.token_endpoint, {
          grant_type: 'refresh_token',
          refresh_token: record.refreshToken,
          client_id: record.clientId,
          resource: RESOURCE
        })
        const next = {
          ...record,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || record.refreshToken,
          expiresAt: clock() + (tokens.expires_in || 3600) * 1000
        }
        if (version !== authVersion) throw new Error('ChatGPT session was signed out')
        await storage.set('chatgpt', next)
        if (version !== authVersion) {
          const saved = await storage.get('chatgpt')
          if (saved && saved.accessToken === next.accessToken) await storage.delete('chatgpt')
          throw new Error('ChatGPT session was signed out')
        }
        return next.accessToken
      })().finally(() => { refreshPromise = null })
    }
    return refreshPromise
  }

  async function signIn () {
    if (pending) throw new Error('ChatGPT sign-in is already in progress')
    const attempt = { cancelled: false, listener: listenerFactory(), controller: new AbortController() }
    pending = attempt
    try {
      const [{ redirectUri, callback }, metadata, hostId] = await Promise.all([
        attempt.listener.ready,
        discoverOIDC(client, ISSUER, { signal: attempt.controller.signal }),
        storage.getOrCreateHostId()
      ])
      const previous = await storage.get('chatgpt')
      const rememberedClientId = await storage.getClientId('chatgpt')
      const rememberedAccountId = await storage.getAccountId('chatgpt')
      const savedClientId = (previous && previous.clientId) || rememberedClientId
      const isNewRegistration = !savedClientId
      const clientId = savedClientId || DYNAMIC_CLIENT_ID
      const { verifier, challenge } = createPkce(random)
      const state = random(32).toString('base64url')
      const nonce = random(32).toString('base64url')
      const authorize = new URL(metadata.authorization_endpoint)
      const authorizationParams = {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: SCOPES,
        resource: RESOURCE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        nonce,
        ext_agent_host_id: hostId
      }
      if (isNewRegistration) authorizationParams.agent_name_hint = 'electerm'
      Object.entries(authorizationParams).forEach(([key, value]) => authorize.searchParams.set(key, value))
      await openExternal(authorize.toString())
      const returned = await callback
      if (attempt.cancelled) throw new Error('Sign-in cancelled')
      if (!exactLoopbackCallback(redirectUri, returned)) throw new Error('OAuth callback mismatch')
      const callbackUrl = new URL(returned)
      if (callbackUrl.searchParams.get('state') !== state) throw new Error('OAuth state mismatch')
      const returnedClientId = callbackUrl.searchParams.get('client_id')
      if (callbackUrl.searchParams.has('error') || !callbackUrl.searchParams.get('code')) throw new Error('OAuth authorization failed')
      let issuedClientId
      if (isNewRegistration) {
        if (!returnedClientId || returnedClientId === DYNAMIC_CLIENT_ID) throw new Error('OAuth registration did not return an issued client ID')
        issuedClientId = returnedClientId
        await storage.setClientId('chatgpt', issuedClientId)
      } else {
        if (returnedClientId && returnedClientId !== clientId) throw new Error('OAuth callback client mismatch')
        issuedClientId = clientId
      }
      const tokens = await postForm(client, metadata.token_endpoint, {
        grant_type: 'authorization_code',
        code: callbackUrl.searchParams.get('code'),
        redirect_uri: redirectUri,
        client_id: issuedClientId,
        code_verifier: verifier,
        resource: RESOURCE
      }, { signal: attempt.controller.signal })
      if (attempt.cancelled) throw new Error('Sign-in cancelled')
      const jwks = (await client.get(metadata.jwks_uri, { timeout: 15000, signal: attempt.controller.signal })).data
      const claims = verifyIdToken(tokens.id_token, jwks, {
        issuer: ISSUER,
        audience: issuedClientId,
        nonce,
        clock
      })
      const expectedAccountId = (previous && previous.account && previous.account.sub) || rememberedAccountId
      if (expectedAccountId && expectedAccountId !== claims.sub) {
        throw new Error('ChatGPT sign-in used a different account')
      }
      const record = {
        clientId: issuedClientId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: clock() + (tokens.expires_in || 3600) * 1000,
        account: { sub: claims.sub, email: claims.email || '' },
        planUsageEnabled: String(tokens.scope || claims.scope || '').split(/\s+/).includes('chatgpt.tokens.use.direct')
      }
      if (attempt.cancelled || pending !== attempt) throw new Error('Sign-in cancelled')
      await storage.set('chatgpt', record)
      if (attempt.cancelled || pending !== attempt) {
        const saved = await storage.get('chatgpt')
        if (saved && saved.accessToken === record.accessToken) await storage.delete('chatgpt')
        throw new Error('Sign-in cancelled')
      }
      try {
        await storage.setAccountId('chatgpt', claims.sub)
      } catch (error) {
        await storage.delete('chatgpt')
        throw error
      }
      if (attempt.cancelled || pending !== attempt) {
        const saved = await storage.get('chatgpt')
        if (saved && saved.accessToken === record.accessToken) await storage.delete('chatgpt')
        throw new Error('Sign-in cancelled')
      }
      return safeStatus(record)
    } catch (error) {
      throw new Error(attempt.cancelled || (error && error.message === 'Sign-in cancelled') ? 'Sign-in cancelled' : safeOAuthError(error))
    } finally {
      attempt.listener.close()
      if (pending === attempt) pending = null
    }
  }

  return {
    signIn,
    cancelSignIn () {
      if (!pending) return { cancelled: false }
      pending.cancelled = true
      pending.controller.abort()
      pending.listener.cancel()
      return { cancelled: true }
    },
    async status () { return safeStatus(await storage.get('chatgpt')) },
    getAccessToken,
    async signOut () {
      authVersion++
      if (pending) this.cancelSignIn()
      const record = await storage.get('chatgpt')
      if (!record) return { signedOut: true }
      try {
        const metadata = await discoverOIDC(client, ISSUER)
        if (metadata.revocation_endpoint && record.refreshToken) {
          await postForm(client, metadata.revocation_endpoint, {
            token: record.refreshToken,
            token_type_hint: 'refresh_token',
            client_id: record.clientId
          })
        }
      } catch (_) {}
      await storage.delete('chatgpt')
      return { signedOut: true }
    }
  }
}

module.exports = { createChatGPTAuth, createCallbackListener, CHATGPT_ISSUER: ISSUER, CHATGPT_SCOPES: SCOPES, CHATGPT_RESOURCE: RESOURCE, CHATGPT_DYNAMIC_CLIENT_ID: DYNAMIC_CLIENT_ID }
