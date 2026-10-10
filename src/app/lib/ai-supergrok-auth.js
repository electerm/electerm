const { randomUUID } = require('node:crypto')
const { postForm, safeOAuthError } = require('./ai-subscription-oauth')

const ISSUER = 'https://auth.x.ai'
const CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'
const SCOPE = 'openid profile email offline_access grok-cli:access api:access'

function createSuperGrokAuth ({ storage, http = require('axios'), openExternal = async () => {}, clock = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = randomUUID }) {
  let currentAttempt
  let refreshPromise
  let authVersion = 0

  function assertCurrent (attempt) {
    if (attempt.cancelled || currentAttempt !== attempt) throw new Error('Sign-in cancelled')
  }

  async function beginSignIn () {
    const attempt = { id: random(), cancelled: false, deviceCode: null, controller: new AbortController() }
    currentAttempt = attempt
    try {
      const device = (await http.post(`${ISSUER}/oauth2/device/code`, new URLSearchParams({
        client_id: CLIENT_ID,
        scope: SCOPE,
        referrer: 'electerm'
      }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, signal: attempt.controller.signal })).data
      if (currentAttempt !== attempt || attempt.cancelled) throw new Error('Sign-in cancelled')
      const verificationUrl = device.verification_uri_complete || device.verification_uri
      let verificationHost = ''
      try { verificationHost = new URL(verificationUrl).hostname } catch (_) {}
      if (typeof verificationUrl !== 'string' || !verificationUrl.startsWith('https://') || !(verificationHost === 'x.ai' || verificationHost.endsWith('.x.ai'))) {
        throw new Error('Invalid verification URL')
      }
      if (typeof device.user_code !== 'string' || !/^[A-Z0-9-]+$/i.test(device.user_code)) throw new Error('Invalid device code response')
      attempt.deviceCode = device.device_code
      attempt.expiresAt = clock() + Math.max(1, device.expires_in || 600) * 1000
      attempt.interval = Math.max(1, device.interval || 5)
      attempt.verificationUrl = verificationUrl
      attempt.userCode = device.user_code
      await openExternal(verificationUrl)
      return {
        attemptId: attempt.id,
        verificationUrl,
        userCode: device.user_code,
        expiresIn: Math.max(1, Math.floor((attempt.expiresAt - clock()) / 1000))
      }
    } catch (error) {
      if (currentAttempt === attempt) currentAttempt = null
      throw new Error(attempt.cancelled ? 'Sign-in cancelled' : safeOAuthError(error))
    }
  }

  async function finishSignIn (attemptId) {
    const attempt = currentAttempt
    if (!attempt || attempt.id !== attemptId) throw new Error('Sign-in attempt not found')
    try {
      while (clock() < attempt.expiresAt) {
        assertCurrent(attempt)
        await sleep(attempt.interval * 1000)
        assertCurrent(attempt)
        const response = await http.post(`${ISSUER}/oauth2/token`, new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: attempt.deviceCode,
          client_id: CLIENT_ID
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, signal: attempt.controller.signal, validateStatus: () => true })
        assertCurrent(attempt)
        const body = response.data || {}
        if (response.status >= 200 && response.status < 300 && body.access_token) {
          const record = {
            accessToken: body.access_token,
            refreshToken: body.refresh_token,
            expiresAt: clock() + (body.expires_in || 21600) * 1000
          }
          assertCurrent(attempt)
          await storage.set('supergrok', record)
          try {
            assertCurrent(attempt)
          } catch (error) {
            const saved = await storage.get('supergrok')
            if (saved && saved.accessToken === record.accessToken) await storage.delete('supergrok')
            throw error
          }
          currentAttempt = null
          return { configured: true, supported: process.platform === 'win32', hint: 'SuperGrok connected' }
        }
        const code = body.error
        if (code === 'authorization_pending') continue
        if (code === 'slow_down') {
          attempt.interval += 5
          continue
        }
        if (code === 'access_denied') throw new Error('SuperGrok authorization was denied. Confirm your account has an eligible subscription.')
        if (code === 'expired_token') throw new Error('SuperGrok device code expired. Start sign-in again.')
        throw new Error('SuperGrok authorization failed')
      }
      throw new Error('SuperGrok device code expired. Start sign-in again.')
    } catch (error) {
      if (currentAttempt === attempt) currentAttempt = null
      throw new Error(attempt.cancelled || error.message === 'Sign-in cancelled' || /subscription|expired/i.test(error.message) ? error.message : safeOAuthError(error))
    }
  }

  async function getAccessToken () {
    const record = await storage.get('supergrok')
    if (record && record.accessToken && record.expiresAt > clock() + 60000) return record.accessToken
    if (!record || !record.refreshToken) throw new Error('SuperGrok is not connected')
    if (!refreshPromise) {
      const version = authVersion
      refreshPromise = (async () => {
        const tokens = await postForm(http, `${ISSUER}/oauth2/token`, {
          grant_type: 'refresh_token',
          refresh_token: record.refreshToken,
          client_id: CLIENT_ID
        })
        const next = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || record.refreshToken,
          expiresAt: clock() + (tokens.expires_in || 21600) * 1000
        }
        if (version !== authVersion) throw new Error('SuperGrok session was signed out')
        await storage.set('supergrok', next)
        if (version !== authVersion) {
          const saved = await storage.get('supergrok')
          if (saved && saved.accessToken === next.accessToken) await storage.delete('supergrok')
          throw new Error('SuperGrok session was signed out')
        }
        return tokens.access_token
      })().finally(() => { refreshPromise = null })
    }
    return refreshPromise
  }

  return {
    beginSignIn,
    finishSignIn,
    cancelSignIn (attemptId) {
      if (!currentAttempt || (attemptId && currentAttempt.id !== attemptId)) return { cancelled: false }
      currentAttempt.cancelled = true
      currentAttempt.controller.abort()
      currentAttempt = null
      return { cancelled: true }
    },
    async status () {
      const record = await storage.get('supergrok')
      return { supported: process.platform === 'win32', configured: !!record, hint: record ? 'SuperGrok connected' : 'SuperGrok subscription sign-in' }
    },
    getAccessToken,
    async signOut () {
      authVersion++
      if (currentAttempt) this.cancelSignIn(currentAttempt.id)
      const record = await storage.get('supergrok')
      try {
        if (record && record.refreshToken) {
          await postForm(http, `${ISSUER}/oauth2/revoke`, { token: record.refreshToken, client_id: CLIENT_ID })
        }
      } catch (_) {}
      await storage.delete('supergrok')
      return { signedOut: true }
    }
  }
}

module.exports = { createSuperGrokAuth, SUPERGROK_ISSUER: ISSUER, SUPERGROK_CLIENT_ID: CLIENT_ID, SUPERGROK_SCOPE: SCOPE }
