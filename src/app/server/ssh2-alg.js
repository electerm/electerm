/**
 * all supported ssh2 algorithms config
 */
const nodeCrypto = require('crypto')
const browserDH = require('diffie-hellman/browser')

nodeCrypto.createDiffieHellmanGroup = browserDH.createDiffieHellmanGroup
nodeCrypto.createDiffieHellman = browserDH.createDiffieHellman

// keep this below the crypto patch above: ssh2 captures
// crypto.createDiffieHellman(Group) when its protocol modules load
const {
  SUPPORTED_KEX,
  SUPPORTED_SERVER_HOST_KEY,
  SUPPORTED_CIPHER,
  SUPPORTED_MAC,
  SUPPORTED_COMPRESSION
} = require('@electerm/ssh2/lib/protocol/constants.js')

/**
 * ssh2 throws "Unsupported algorithm: xxx" as soon as a list contains a name
 * it does not implement, so drop anything this build of ssh2 dropped itself
 * (blowfish-cbc, arcfour* were removed from the fork). Without the filter the
 * legacy retry (algAlt) dies before the handshake with
 * "Unsupported algorithm: blowfish-cbc" instead of connecting to old devices.
 * @param {string[]} list
 * @param {string[]} supported
 * @returns {string[]}
 */
const onlySupported = (list, supported) => list.filter(name => supported.includes(name))

exports.algDefault = () => ({
  kex: onlySupported([
    'curve25519-sha256', // (node v13.9.0 or newer)
    'curve25519-sha256@libssh.org', // (node v13.9.0 or newer)
    'diffie-hellman-group14-sha256',
    'diffie-hellman-group15-sha512',
    'diffie-hellman-group16-sha512',
    'diffie-hellman-group17-sha512',
    'diffie-hellman-group18-sha512',
    'ecdh-sha2-nistp256',
    'ecdh-sha2-nistp384',
    'ecdh-sha2-nistp521',
    'diffie-hellman-group-exchange-sha256',
    // legacy, for old devices/routers: only ever negotiated when the server
    // has nothing better to offer
    'diffie-hellman-group14-sha1',
    'diffie-hellman-group-exchange-sha1',
    'diffie-hellman-group1-sha1'
  ], SUPPORTED_KEX),
  hmac: onlySupported([
    'hmac-sha2-256',
    'hmac-sha2-512',
    'hmac-sha1',
    'hmac-md5',
    'hmac-sha2-256-96',
    'hmac-sha2-512-96',
    'hmac-ripemd160',
    'hmac-sha1-96',
    'hmac-md5-96',
    'hmac-sha2-256-etm@openssh.com',
    'hmac-sha2-512-etm@openssh.com',
    'hmac-sha1-etm@openssh.com'
  ], SUPPORTED_MAC),
  compress: onlySupported([
    'zlib@openssh.com',
    'zlib',
    'none'
  ], SUPPORTED_COMPRESSION)
})

/**
 * the fallback list used by reTryAltAlg() when no algorithm could be
 * negotiated with algDefault(): a strict superset of algDefault() with the
 * pre-RFC 8332 stuff old servers/devices still use (CBC ciphers, ssh-rsa and
 * ssh-dss host keys)
 */
exports.algAlt = () => ({
  ...exports.algDefault(),
  cipher: onlySupported([
    // 'chacha20-poly1305@openssh.com',
    'aes128-ctr',
    'aes192-ctr',
    'aes256-ctr',
    'aes128-gcm',
    'aes128-gcm@openssh.com',
    'aes256-gcm',
    'aes256-gcm@openssh.com',
    'aes256-cbc',
    'aes192-cbc',
    'aes128-cbc',
    'aes128-ctr',
    'aes192-ctr',
    'aes256-ctr',
    'blowfish-cbc',
    '3des-cbc',
    'arcfour256',
    'arcfour128',
    // 'cast128-cbc',
    'arcfour'
  ], SUPPORTED_CIPHER),
  serverHostKey: onlySupported([
    'ssh-rsa',
    'ssh-ed25519',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'ssh-dss',
    'rsa-sha2-512',
    'rsa-sha2-256'
  ], SUPPORTED_SERVER_HOST_KEY)
})
