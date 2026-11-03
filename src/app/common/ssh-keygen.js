/**
 * ssh key pair generation.
 *
 * This runs in the server child -- the same process that later reads
 * `privateKeyPath` when connecting -- so in the desktop app the keys land on
 * this machine's disk and in web app mode on the host's, which is where the
 * session will look for them.
 */

const fss = require('fs/promises')
const os = require('os')
const path = require('path')
const log = require('./log')

// what `ssh-keygen -N` uses for the new OpenSSH format
const DEFAULT_CIPHER = 'aes256-ctr'
const KEY_TYPES = ['ed25519', 'rsa', 'ecdsa']
const BITS = {
  rsa: [2048, 3072, 4096],
  ecdsa: [256, 384, 521]
}
const DEFAULT_NAME = {
  ed25519: 'id_ed25519',
  rsa: 'id_rsa',
  ecdsa: 'id_ecdsa'
}
const MAX_KEYS_PER_NAME = 100

function sshKeyDir () {
  // the server child gets this from the main process; the fallback covers a
  // direct require (tests) and any other host of this module
  return process.env.sshKeysPath || path.join(os.homedir(), '.ssh')
}

/**
 * Resolve `~`, `~/.ssh` or a plain path on the machine this runs on.
 * @param {string} [p]
 * @returns {string}
 */
function expandPath (p) {
  const s = String(p || '').trim()
  if (!s) {
    return sshKeyDir()
  }
  if (s === '~') {
    return os.homedir()
  }
  if (s.startsWith('~/') || s.startsWith('~\\')) {
    return path.join(os.homedir(), s.slice(2))
  }
  return path.resolve(s)
}

// a file name only: no directory part, no separators, nothing that escapes `dir`
function toFileName (name, type) {
  const base = String(name || '')
    .trim()
    .split(/[\\/]/)
    .pop()
    .replace(/[\0<>:"|?*]/g, '')
    .trim()
  if (!base || base === '.' || base === '..') {
    return DEFAULT_NAME[type]
  }
  return base
}

async function exists (p) {
  try {
    await fss.access(p)
    return true
  } catch (err) {
    return false
  }
}

/**
 * Never overwrite: the files in ~/.ssh are the user's own keys, so an existing
 * `id_ed25519` becomes `id_ed25519_1` instead of being clobbered.
 */
async function uniquePath (dir, fileName) {
  const first = path.join(dir, fileName)
  if (!await exists(first)) {
    return first
  }
  for (let i = 1; i <= MAX_KEYS_PER_NAME; i++) {
    const p = path.join(dir, `${fileName}_${i}`)
    if (!await exists(p)) {
      return p
    }
  }
  throw new Error(`too many keys named ${fileName} in ${dir}`)
}

function generateKeyPair (type, opts) {
  // required lazily: ssh2 is heavy and only needed on this one click
  const { utils } = require('@electerm/ssh2')
  return new Promise((resolve, reject) => {
    utils.generateKeyPair(type, opts, (err, keys) => {
      if (err) {
        return reject(err)
      }
      resolve(keys)
    })
  })
}

/**
 * @param {object} [opts]
 * @param {string} [opts.type] ed25519|rsa|ecdsa, default ed25519
 * @param {number} [opts.bits] rsa: 2048|3072|4096, ecdsa: 256|384|521
 * @param {string} [opts.dir] directory, `~/.ssh` when empty
 * @param {string} [opts.fileName] private key file name
 * @param {string} [opts.passphrase] encrypt the private key with it when set
 * @param {string} [opts.comment] public key comment
 * @returns {Promise<object>} { privateKeyPath, publicKeyPath, privateKey, publicKey, dir, type, passphraseProtected }
 */
async function generateSshKeyPair (opts = {}) {
  const type = KEY_TYPES.includes(opts.type) ? opts.type : 'ed25519'
  const dir = expandPath(opts.dir)
  const fileName = toFileName(opts.fileName, type)
  const comment = String(opts.comment || '').trim().slice(0, 200)
  const passphrase = typeof opts.passphrase === 'string' ? opts.passphrase : ''
  const genOpts = { comment }
  if (BITS[type]) {
    const bits = parseInt(opts.bits, 10)
    genOpts.bits = BITS[type].includes(bits) ? bits : BITS[type][0]
  }
  if (passphrase) {
    // ssh2 refuses a passphrase without a cipher; this is the one ssh-keygen uses
    genOpts.passphrase = passphrase
    genOpts.cipher = DEFAULT_CIPHER
  }
  await fss.mkdir(dir, { recursive: true, mode: 0o700 })
  const privateKeyPath = await uniquePath(dir, fileName)
  const publicKeyPath = privateKeyPath + '.pub'
  const keys = await generateKeyPair(type, genOpts)
  try {
    // 0600: ssh refuses a private key that anyone else can read
    await fss.writeFile(privateKeyPath, keys.private, { mode: 0o600 })
    await fss.chmod(privateKeyPath, 0o600)
    await fss.writeFile(publicKeyPath, keys.public, { mode: 0o644 })
  } catch (err) {
    await fss.unlink(privateKeyPath).catch(() => {})
    await fss.unlink(publicKeyPath).catch(() => {})
    throw err
  }
  log.info('ssh key generated', privateKeyPath)
  return {
    privateKeyPath,
    publicKeyPath,
    // returned so the form can offer "copy private key" without a second read;
    // the same bytes that were just written to privateKeyPath
    privateKey: keys.private,
    publicKey: keys.public.trim(),
    dir,
    type,
    passphraseProtected: !!passphrase
  }
}

module.exports = {
  generateSshKeyPair,
  sshKeyDir,
  expandPath
}
