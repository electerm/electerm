/**
 * Test: the algorithm lists electerm hands to ssh2 must only contain names
 * this ssh2 build actually implements.
 *
 * ssh2 throws "Unsupported algorithm: xxx" and aborts the connection as soon
 * as a list contains a name it does not know, so one stale entry turns the
 * whole list (and, for the retry list, the whole fallback path) into a
 * hard failure.
 *
 * Regression this pins: algAlt() still listed blowfish-cbc / arcfour*, which
 * the ssh2 fork dropped, so the legacy retry (old devices that only offer
 * CBC ciphers + hmac-sha1) died with "Unsupported algorithm: blowfish-cbc"
 * before the handshake even started.
 *
 * Also pins the presence of the legacy kex names old routers still speak:
 * diffie-hellman-group1-sha1, diffie-hellman-group14-sha1 and
 * diffie-hellman-group-exchange-sha1.
 */

process.env.NODE_ENV = 'development'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { algDefault, algAlt } = require('../../app/server/ssh2-alg')
const {
  SUPPORTED_KEX,
  SUPPORTED_SERVER_HOST_KEY,
  SUPPORTED_CIPHER,
  SUPPORTED_MAC,
  SUPPORTED_COMPRESSION
} = require('@electerm/ssh2/lib/protocol/constants.js')

// name in the config -> the ssh2 list it is validated against
const listSpec = [
  ['kex', SUPPORTED_KEX],
  ['hmac', SUPPORTED_MAC],
  ['compress', SUPPORTED_COMPRESSION],
  ['cipher', SUPPORTED_CIPHER],
  ['serverHostKey', SUPPORTED_SERVER_HOST_KEY]
]

describe('ssh2 algorithm lists', () => {
  test('only contain algorithms this ssh2 build implements', () => {
    for (const [name, supported] of listSpec) {
      for (const list of [algDefault(), algAlt()]) {
        const names = list[name]
        if (names === undefined) {
          continue
        }
        const unsupported = names.filter(a => !supported.includes(a))
        assert.deepEqual(
          unsupported,
          [],
          `${name} list contains algorithm(s) ssh2 rejects: ${unsupported.join(', ')}`
        )
      }
    }
  })

  test('keep the legacy kex old devices use', () => {
    const { kex } = algDefault()
    for (const legacy of [
      'diffie-hellman-group1-sha1',
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group-exchange-sha1'
    ]) {
      assert.ok(kex.includes(legacy), `algDefault().kex is missing ${legacy}`)
    }
  })

  test('algAlt adds legacy options without dropping algDefault ones', () => {
    const def = algDefault()
    const alt = algAlt()
    // same kex/hmac/compress: the retry only broadens cipher + host key, so a
    // server that failed with algDefault can never get worse with algAlt
    for (const name of ['kex', 'hmac', 'compress']) {
      assert.deepEqual(alt[name], def[name], `${name} changed between alg lists`)
    }
    // the fallback list still offers modern crypto alongside the legacy names
    assert.ok(alt.cipher.includes('aes128-ctr'))
    assert.ok(alt.cipher.includes('aes128-cbc'))
    assert.ok(alt.cipher.includes('3des-cbc'))
    assert.ok(alt.serverHostKey.includes('ssh-ed25519'))
    assert.ok(alt.serverHostKey.includes('ssh-rsa'))
    assert.ok(alt.serverHostKey.includes('ssh-dss'))
  })
})
