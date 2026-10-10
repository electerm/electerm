const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createSuperGrokAuth } = require('../../app/lib/ai-supergrok-auth')

describe('SuperGrok device authorization', () => {
  it('returns only device instructions and persists tokens after approval', async () => {
    const calls = []
    const storage = { record: null, async get () { return this.record }, async set (_, value) { this.record = value }, async delete () { this.record = null } }
    const http = {
      async post (url, body) {
        calls.push({ url, body })
        if (url.endsWith('/device/code')) return { data: { device_code: 'private-device-code', user_code: 'ABCD-1234', verification_uri: 'https://x.ai/activate', expires_in: 60, interval: 1 } }
        return { status: 200, data: { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 300 } }
      }
    }
    const auth = createSuperGrokAuth({ storage, http, openExternal: async () => {}, sleep: async () => {}, clock: () => 1000 })
    const response = await auth.beginSignIn()
    assert.deepEqual(Object.keys(response).sort(), ['attemptId', 'expiresIn', 'userCode', 'verificationUrl'].sort())
    assert.equal(JSON.stringify(response).includes('private-device-code'), false)
    await auth.finishSignIn(response.attemptId)
    assert.equal(storage.record.accessToken, 'private-access')
    assert.equal(new URLSearchParams(calls[1].body).get('device_code'), 'private-device-code')
    assert.equal(JSON.stringify(await auth.status()).includes('private-access'), false)
  })

  it('cancels a pending attempt without persisting a late token response', async () => {
    let release
    const storage = { record: null, async get () { return this.record }, async set (_, value) { this.record = value }, async delete () { this.record = null } }
    const http = {
      async post (url) {
        if (url.endsWith('/device/code')) return { data: { device_code: 'code', user_code: 'CODE', verification_uri: 'https://x.ai/activate', expires_in: 60, interval: 1 } }
        return new Promise(resolve => { release = () => resolve({ data: { access_token: 'late' } }) })
      }
    }
    const auth = createSuperGrokAuth({ storage, http, openExternal: async () => {}, sleep: async () => {}, clock: () => 1000 })
    const { attemptId } = await auth.beginSignIn()
    const finished = auth.finishSignIn(attemptId)
    await new Promise(resolve => setImmediate(resolve))
    auth.cancelSignIn(attemptId)
    release()
    await assert.rejects(finished, /cancel/i)
    assert.equal(storage.record, null)
  })

  it('honors authorization_pending and slow_down while completing the device flow', async () => {
    let now = 1000
    let polls = 0
    const delays = []
    const storage = {
      record: null,
      async get () { return this.record },
      async set (_, value) { this.record = value },
      async delete () { this.record = null }
    }
    const http = {
      async post (url) {
        if (url.endsWith('/device/code')) {
          return { data: { device_code: 'device', user_code: 'CODE', verification_uri: 'https://x.ai/activate', expires_in: 60, interval: 1 } }
        }
        polls++
        if (polls === 1) return { status: 400, data: { error: 'authorization_pending' } }
        if (polls === 2) return { status: 400, data: { error: 'slow_down' } }
        return { status: 200, data: { access_token: 'approved', refresh_token: 'refresh', expires_in: 300 } }
      }
    }
    const auth = createSuperGrokAuth({
      storage,
      http,
      openExternal: async () => {},
      clock: () => now,
      sleep: async ms => { delays.push(ms); now += ms }
    })
    const { attemptId } = await auth.beginSignIn()
    await auth.finishSignIn(attemptId)
    assert.deepEqual(delays, [1000, 1000, 6000])
    assert.equal(storage.record.accessToken, 'approved')
  })

  it('retains the prior refresh token when xAI omits a rotated token', async () => {
    const storage = {
      record: { accessToken: 'expired', refreshToken: 'old-refresh', expiresAt: 0 },
      async get () { return this.record },
      async set (_, value) { this.record = value },
      async delete () { this.record = null }
    }
    let requestBody
    const http = {
      async post (url, body) {
        requestBody = { url, body }
        return { data: { access_token: 'new-access', expires_in: 600 } }
      }
    }
    const auth = createSuperGrokAuth({ storage, http, clock: () => 100000 })
    assert.equal(await auth.getAccessToken(), 'new-access')
    assert.equal(new URLSearchParams(requestBody.body).get('refresh_token'), 'old-refresh')
    assert.equal(storage.record.refreshToken, 'old-refresh')
  })

  it('treats access_denied as a final subscription eligibility error', async () => {
    const storage = { async get () { return null }, async set () {}, async delete () {} }
    const http = {
      async post (url) {
        if (url.endsWith('/device/code')) {
          return { data: { device_code: 'device', user_code: 'CODE', verification_uri: 'https://x.ai/activate', expires_in: 60, interval: 1 } }
        }
        return { status: 403, data: { error: 'access_denied' } }
      }
    }
    const auth = createSuperGrokAuth({ storage, http, openExternal: async () => {}, sleep: async () => {}, clock: () => 1000 })
    const { attemptId } = await auth.beginSignIn()
    await assert.rejects(auth.finishSignIn(attemptId), /eligible subscription/i)
  })
})
