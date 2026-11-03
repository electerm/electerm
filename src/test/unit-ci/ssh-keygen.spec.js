// runtime-constants (via ../common/log) can only load its package.json with the
// dev flag outside a packaged app -- see log-debug-level.spec.js
process.env.NODE_ENV = 'development'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const {
  generateSshKeyPair,
  expandPath,
  sshKeyDir
} = require('../../app/common/ssh-keygen')

const ssh2 = require('@electerm/ssh2')

let base

function tmpDir (name) {
  const dir = path.join(base, name)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function hasSshKeygen () {
  try {
    execFileSync('ssh-keygen', ['-?'], { stdio: 'ignore' })
    return true
  } catch (err) {
    // `ssh-keygen -?` exits non-zero on every platform; what matters is that it ran
    return err.code !== 'ENOENT'
  }
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ssh-keygen-'))
})

after(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

describe('ssh-keygen expandPath', () => {
  it('expands ~ and ~/... to the home directory', () => {
    assert.equal(expandPath('~'), os.homedir())
    assert.equal(expandPath('~/.ssh'), path.join(os.homedir(), '.ssh'))
  })

  it('resolves a plain path and falls back to the ssh key dir when empty', () => {
    assert.equal(expandPath('/tmp/x'), path.resolve('/tmp/x'))
    assert.equal(expandPath(''), sshKeyDir())
  })
})

describe('ssh-keygen generateSshKeyPair', () => {
  it('writes an OpenSSH ed25519 pair into the requested dir', async () => {
    const dir = tmpDir('ed25519')
    const res = await generateSshKeyPair({
      type: 'ed25519',
      dir,
      fileName: 'id_ed25519',
      comment: 'me@example.com'
    })
    assert.equal(res.privateKeyPath, path.join(dir, 'id_ed25519'))
    assert.equal(res.publicKeyPath, path.join(dir, 'id_ed25519.pub'))
    assert.equal(res.type, 'ed25519')
    assert.equal(res.passphraseProtected, false)

    const priv = fs.readFileSync(res.privateKeyPath, 'utf8')
    const pub = fs.readFileSync(res.publicKeyPath, 'utf8')
    assert.match(priv, /^-----BEGIN OPENSSH PRIVATE KEY-----\n/)
    assert.match(pub, /^ssh-ed25519 AAAA/)
    assert.match(pub, /me@example\.com$/)
    assert.equal(res.publicKey, pub.trim())
    // the content the form copies must be exactly what landed on disk
    assert.equal(res.privateKey, priv)

    // the returned key must be readable by the same parser the session uses
    const parsed = ssh2.utils.parseKey(priv)
    assert.ok(!(parsed instanceof Error), parsed && parsed.message)
    assert.equal(parsed.type, 'ssh-ed25519')
  })

  it('makes the private key 0600 and the public key readable', { skip: process.platform === 'win32' }, async () => {
    const dir = tmpDir('mode')
    const res = await generateSshKeyPair({ dir, fileName: 'id_mode' })
    assert.equal(fs.statSync(res.privateKeyPath).mode & 0o777, 0o600)
    assert.equal(fs.statSync(res.publicKeyPath).mode & 0o777, 0o644)
  })

  it('never overwrites an existing key', async () => {
    const dir = tmpDir('no-overwrite')
    const first = await generateSshKeyPair({ dir, fileName: 'id_x' })
    const second = await generateSshKeyPair({ dir, fileName: 'id_x' })
    assert.equal(first.privateKeyPath, path.join(dir, 'id_x'))
    assert.equal(second.privateKeyPath, path.join(dir, 'id_x_1'))
    // the first key must still be the first key
    assert.notEqual(
      fs.readFileSync(first.privateKeyPath, 'utf8'),
      fs.readFileSync(second.privateKeyPath, 'utf8')
    )
  })

  it('keeps a file name from escaping the target dir', async () => {
    const dir = tmpDir('traversal')
    const res = await generateSshKeyPair({ dir, fileName: '../../evil' })
    assert.equal(path.dirname(res.privateKeyPath), dir)
    assert.equal(path.basename(res.privateKeyPath), 'evil')
  })

  it('falls back to the default name and type for junk input', async () => {
    const dir = tmpDir('junk')
    const res = await generateSshKeyPair({ dir, fileName: '   ', type: 'nope' })
    assert.equal(res.type, 'ed25519')
    assert.equal(path.basename(res.privateKeyPath), 'id_ed25519')
  })

  it('generates rsa and ecdsa keys of the requested size', async () => {
    const dir = tmpDir('sizes')
    const rsa = await generateSshKeyPair({ type: 'rsa', bits: 2048, dir, fileName: 'id_rsa' })
    assert.match(rsa.publicKey, /^ssh-rsa /)
    const ecdsa = await generateSshKeyPair({ type: 'ecdsa', bits: 384, dir, fileName: 'id_ecdsa' })
    assert.match(ecdsa.publicKey, /^ecdsa-sha2-nistp384 /)
  })

  it('encrypts the private key when a passphrase is given', async () => {
    const dir = tmpDir('passphrase')
    const res = await generateSshKeyPair({
      dir,
      fileName: 'id_pass',
      passphrase: 'secret'
    })
    assert.equal(res.passphraseProtected, true)
    const priv = fs.readFileSync(res.privateKeyPath, 'utf8')
    assert.equal(ssh2.utils.parseKey(priv).message, 'Encrypted private OpenSSH key detected, but no passphrase given')
    const parsed = ssh2.utils.parseKey(priv, 'secret')
    assert.ok(!(parsed instanceof Error), parsed && parsed.message)
    assert.equal(parsed.type, 'ssh-ed25519')
  })

  it('produces a key real ssh-keygen accepts', { skip: !hasSshKeygen() }, async () => {
    const dir = tmpDir('real-ssh-keygen')
    const res = await generateSshKeyPair({ dir, fileName: 'id_real' })
    const derived = execFileSync('ssh-keygen', ['-y', '-f', res.privateKeyPath])
      .toString()
      .trim()
      .split(' ')[1]
    assert.equal(derived, res.publicKey.split(' ')[1])
  })
})
