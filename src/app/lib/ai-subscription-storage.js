const path = require('node:path')
const fsDefault = require('node:fs/promises')
const { randomUUID } = require('node:crypto')

const providers = new Set(['chatgpt', 'supergrok'])

function createSubscriptionStorage ({ appPath, dataPath, userName = 'default_user', safeStorage, fs = fsDefault, random = randomUUID }) {
  const root = path.join(dataPath || appPath, 'users', userName, 'ai-subscriptions')

  function assertProvider (provider) {
    if (!providers.has(provider)) throw new Error('Unsupported AI subscription provider')
  }

  function encrypt (value) {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function' || !safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-backed encryption is unavailable')
    }
    return safeStorage.encryptString(value).toString('base64')
  }

  async function read (filename) {
    try {
      const ciphertext = await fs.readFile(path.join(root, filename), 'utf8')
      if (!ciphertext.startsWith('v1:')) return null
      const value = safeStorage.decryptString(Buffer.from(ciphertext.slice(3), 'base64'))
      return JSON.parse(value)
    } catch (_) {
      return null
    }
  }

  async function write (filename, value) {
    const ciphertext = `v1:${encrypt(JSON.stringify(value))}`
    await fs.mkdir(root, { recursive: true })
    const target = path.join(root, filename)
    const temp = `${target}.${random()}.tmp`
    try {
      await fs.writeFile(temp, ciphertext, { mode: 0o600 })
      await fs.rename(temp, target)
    } catch (error) {
      await fs.rm(temp, { force: true }).catch(() => {})
      throw error
    }
  }

  return {
    get (provider) {
      assertProvider(provider)
      return read(`${provider}.json`)
    },
    set (provider, record) {
      assertProvider(provider)
      return write(`${provider}.json`, record)
    },
    async delete (provider) {
      assertProvider(provider)
      await fs.rm(path.join(root, `${provider}.json`), { force: true })
    },
    async getOrCreateHostId () {
      const current = await read('host.json')
      if (current && typeof current.id === 'string') {
        if (current.id.startsWith('urn:uuid:') || current.id.startsWith('urn:ietf:params:oauth:jwk-thumbprint:') || current.id.startsWith('did:key:')) return current.id
        const id = `urn:uuid:${current.id}`
        await write('host.json', { ...current, id })
        return id
      }
      const id = `urn:uuid:${random()}`
      await write('host.json', { id })
      return id
    },
    async getClientId (provider) {
      assertProvider(provider)
      const current = await read('host.json')
      return current && current.clientIds && current.clientIds[provider]
    },
    async setClientId (provider, clientId) {
      assertProvider(provider)
      const current = await read('host.json') || { id: `urn:uuid:${random()}`, clientIds: {} }
      current.clientIds = { ...current.clientIds, [provider]: clientId }
      await write('host.json', current)
    },
    async getAccountId (provider) {
      assertProvider(provider)
      const current = await read('host.json')
      return current && current.accountIds && current.accountIds[provider]
    },
    async setAccountId (provider, accountId) {
      assertProvider(provider)
      const current = await read('host.json') || { id: `urn:uuid:${random()}`, clientIds: {} }
      current.accountIds = { ...current.accountIds, [provider]: accountId }
      await write('host.json', current)
    }
  }
}

function createDefaultSubscriptionStorage () {
  const { appPath } = require('../common/app-props')
  const userName = require('../common/default-user-name')
  const { safeStorage } = require('electron')
  return createSubscriptionStorage({ appPath, userName, safeStorage })
}

module.exports = { createSubscriptionStorage, createDefaultSubscriptionStorage }
