const assert = require('node:assert/strict')
const { describe, test } = require('node:test')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const { join } = require('path')
const { generateKeyPairSync } = require('@electerm/ssh2/lib/keygen.js')

const {
  appendKnownHost,
  buildHostMismatchPrompt,
  checkKnownHosts,
  getHostKeyMeta,
  matchesKnownHostField,
  removeKnownHost,
  replaceKnownHost
} = require('../../src/app/server/ssh-known-hosts')

function createHostKey (label) {
  const pair = generateKeyPairSync('ed25519')
  const publicKey = `${pair.public} ${label}`.trim()
  return Buffer.from(publicKey.split(/\s+/)[1], 'base64')
}

describe('ssh known_hosts verification', () => {
  test('matches hashed host entries', () => {
    const salt = crypto.randomBytes(20)
    const host = 'example.test'
    const digest = crypto.createHmac('sha1', salt).update(host).digest('base64')
    const token = `|1|${salt.toString('base64')}|${digest}`
    assert.equal(matchesKnownHostField(token, host, 22), true)
    assert.equal(matchesKnownHostField(token, 'other.test', 22), false)
  })

  test('treats same-type key changes as mismatches', async () => {
    const tempDir = await fs.promises.mkdtemp(join(os.tmpdir(), 'electerm-known-hosts-'))
    try {
      const knownHostsPath = join(tempDir, 'known_hosts')
      const originalKey = createHostKey('original')
      const changedKey = createHostKey('changed')
      await appendKnownHost({
        host: 'example.test',
        port: 22,
        hostKey: originalKey,
        knownHostsPath
      })
      const result = await checkKnownHosts({
        host: 'example.test',
        port: 22,
        hostKey: changedKey,
        knownHostsPath
      })
      assert.equal(result.status, 'mismatch')
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  })

  test('writes and re-reads a non-default port entry', async () => {
    const tempDir = await fs.promises.mkdtemp(join(os.tmpdir(), 'electerm-known-hosts-'))
    try {
      const knownHostsPath = join(tempDir, 'known_hosts')
      const hostKey = createHostKey('port-2222')
      const meta = getHostKeyMeta(hostKey)
      await appendKnownHost({
        host: '127.0.0.1',
        port: 2222,
        hostKey,
        knownHostsPath
      })
      const content = await fs.promises.readFile(knownHostsPath, 'utf8')
      assert.match(content, /^\[127\.0\.0\.1\]:2222 ssh-ed25519 /)
      const result = await checkKnownHosts({
        host: '127.0.0.1',
        port: 2222,
        hostKey,
        knownHostsPath
      })
      assert.equal(result.status, 'match')
      assert.equal(result.meta.sha256, meta.sha256)
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  })

  test('removeKnownHost removes matching entry', async () => {
    const tempDir = await fs.promises.mkdtemp(join(os.tmpdir(), 'electerm-known-hosts-'))
    try {
      const knownHostsPath = join(tempDir, 'known_hosts')
      const key1 = createHostKey('host1')
      const key2 = createHostKey('host2')
      await appendKnownHost({
        host: 'host1.test',
        port: 22,
        hostKey: key1,
        knownHostsPath
      })
      await appendKnownHost({
        host: 'host2.test',
        port: 22,
        hostKey: key2,
        knownHostsPath
      })
      await removeKnownHost({
        host: 'host1.test',
        port: 22,
        keyType: 'ssh-ed25519',
        knownHostsPath
      })
      const result1 = await checkKnownHosts({
        host: 'host1.test',
        port: 22,
        hostKey: key1,
        knownHostsPath
      })
      assert.equal(result1.status, 'not-found')
      const result2 = await checkKnownHosts({
        host: 'host2.test',
        port: 22,
        hostKey: key2,
        knownHostsPath
      })
      assert.equal(result2.status, 'match')
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  })

  test('replaceKnownHost updates a changed key', async () => {
    const tempDir = await fs.promises.mkdtemp(join(os.tmpdir(), 'electerm-known-hosts-'))
    try {
      const knownHostsPath = join(tempDir, 'known_hosts')
      const originalKey = createHostKey('original')
      const newKey = createHostKey('new')
      await appendKnownHost({
        host: 'router.test',
        port: 22,
        hostKey: originalKey,
        knownHostsPath
      })
      await replaceKnownHost({
        host: 'router.test',
        port: 22,
        hostKey: newKey,
        knownHostsPath
      })
      const oldResult = await checkKnownHosts({
        host: 'router.test',
        port: 22,
        hostKey: originalKey,
        knownHostsPath
      })
      assert.equal(oldResult.status, 'mismatch')
      const newResult = await checkKnownHosts({
        host: 'router.test',
        port: 22,
        hostKey: newKey,
        knownHostsPath
      })
      assert.equal(newResult.status, 'match')
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  })

  test('buildHostMismatchPrompt returns a confirm prompt with warning', () => {
    const meta = {
      keyType: 'ssh-ed25519',
      sha256: 'AAABBBCCC123'
    }
    const prompt = buildHostMismatchPrompt({
      host: 'router.test',
      port: 22,
      meta,
      knownHostsPath: '/home/user/.ssh/known_hosts'
    })
    assert.equal(prompt.mode, 'confirm')
    assert.equal(prompt.submitText, 'Update Key')
    assert.equal(prompt.cancelText, 'Reject')
    assert.ok(prompt.instructions.some(i => i.includes('WARNING')))
    assert.ok(prompt.instructions.some(i => i.includes('router.test')))
  })
})
