/**
 * all supported ssh2 algorithms config
 */

module.exports = {
  kex: [
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
    'diffie-hellman-group14-sha1',
    'diffie-hellman-group-exchange-sha1',
    'diffie-hellman-group1-sha1'
  ],
  cipher: [
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
  ],
  serverHostKey: [
    'ssh-ed25519',
    'ssh-rsa',
    'rsa-sha2-512',
    'rsa-sha2-256',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'ssh-dss'
  ],
  hmac: [
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
  ]
}
