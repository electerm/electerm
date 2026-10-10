const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createSubscriptionStorage } = require('../../app/lib/ai-subscription-storage')

describe('AI subscription storage', () => {
  it('encrypts provider records, round-trips them, and keeps a stable host ID', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ai-'))
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(`enc:${value}`),
      decryptString: value => value.toString().replace(/^enc:/, '')
    }
    try {
      const storage = createSubscriptionStorage({ appPath: root, userName: 'user', safeStorage })
      await storage.set('chatgpt', { refreshToken: 'secret' })
      const file = path.join(root, 'users', 'user', 'ai-subscriptions', 'chatgpt.json')
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /secret/)
      assert.deepEqual(await storage.get('chatgpt'), { refreshToken: 'secret' })
      const hostId = await storage.getOrCreateHostId()
      assert.match(hostId, /^urn:uuid:/)
      assert.equal(hostId, await storage.getOrCreateHostId())
      await storage.setClientId('chatgpt', 'issued-client')
      await storage.setAccountId('chatgpt', 'account-id')
      await storage.delete('chatgpt')
      assert.equal(await storage.get('chatgpt'), null)
      assert.equal(await storage.getClientId('chatgpt'), 'issued-client')
      assert.equal(await storage.getAccountId('chatgpt'), 'account-id')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails closed when encryption is unavailable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ai-'))
    try {
      const storage = createSubscriptionStorage({ appPath: root, userName: 'user', safeStorage: { isEncryptionAvailable: () => false } })
      await assert.rejects(storage.set('chatgpt', { refreshToken: 'secret' }), /encryption/i)
      assert.equal(fs.existsSync(path.join(root, 'users', 'user', 'ai-subscriptions', 'chatgpt.json')), false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps provider records separate, tolerates corrupt records, and preserves the old file on a failed rename', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ai-'))
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(`enc:${value}`),
      decryptString: value => value.toString().replace(/^enc:/, '')
    }
    try {
      const storage = createSubscriptionStorage({ appPath: root, userName: 'user', safeStorage })
      await storage.set('chatgpt', { marker: 'first' })
      await storage.set('supergrok', { marker: 'second' })
      assert.deepEqual(await storage.get('chatgpt'), { marker: 'first' })
      assert.deepEqual(await storage.get('supergrok'), { marker: 'second' })

      const filename = path.join(root, 'users', 'user', 'ai-subscriptions', 'chatgpt.json')
      fs.writeFileSync(filename, 'corrupt')
      assert.equal(await storage.get('chatgpt'), null)
      await storage.set('chatgpt', { marker: 'preserved' })

      const failingFs = {
        ...fsPromises,
        rename: async () => { throw new Error('synthetic rename failure') }
      }
      const failingStorage = createSubscriptionStorage({ appPath: root, userName: 'user', safeStorage, fs: failingFs })
      await assert.rejects(failingStorage.set('chatgpt', { marker: 'must-not-replace' }), /rename failure/)
      assert.deepEqual(await storage.get('chatgpt'), { marker: 'preserved' })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('never writes plaintext when encryption itself throws', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ai-'))
    try {
      const storage = createSubscriptionStorage({
        appPath: root,
        userName: 'user',
        safeStorage: {
          isEncryptionAvailable: () => true,
          encryptString: () => { throw new Error('OS encryption failed') }
        }
      })
      await assert.rejects(storage.set('supergrok', { refreshToken: 'private-value' }), /OS encryption failed/)
      assert.equal(fs.existsSync(path.join(root, 'users', 'user', 'ai-subscriptions')), false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
