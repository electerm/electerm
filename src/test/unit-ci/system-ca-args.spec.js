process.env.NODE_ENV = 'development'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { join } = require('path')

const getSystemCAs = require('../../app/lib/system-ca')

const {
  buildMacArgs, buildWinArgs, WIN_CA_SCRIPT
} = getSystemCAs

// The system CA dump is what makes sync (and every other outbound https call in
// the server child process) trust an internal / self-signed CA, via
// NODE_EXTRA_CA_CERTS in child-process.js. It used to be collected by handing
// a concatenated command line to exec(), so a home directory containing a space
// cut the login keychain path in half, `security` failed, and the loader
// returned '' without saying anything: users who had correctly installed their
// CA into the OS store still got "unable to get local issuer certificate".
//
// Both loaders now use execFile with an argv array, so no path is ever parsed
// by a shell. These tests pin the argv shape.
const homes = [
  '/Users/zx',
  '/Users/john doe',
  "/Users/o'brien",
  '/Users/a&calc',
  '/Users/a"b',
  '/Users/$(id)'
]

const decode = (arg) => Buffer.from(arg, 'base64').toString('utf16le')

describe('buildMacArgs', () => {
  test('passes the login keychain as one argv entry, joined not concatenated', () => {
    const args = buildMacArgs('/Users/zx')
    assert.deepEqual(args.slice(0, 3), ['find-certificate', '-a', '-p'])
    assert.equal(
      args[args.length - 1],
      join('/Users/zx', 'Library/Keychains/login.keychain-db')
    )
    assert.equal(args.length, 6)
  })

  test('a home directory with a space stays a single argument', () => {
    const args = buildMacArgs('/Users/john doe')
    assert.equal(
      args[args.length - 1],
      '/Users/john doe/Library/Keychains/login.keychain-db'
    )
    assert.ok(
      args.filter(a => a.includes('/Users/john doe')).length === 1,
      'the path must not be split across argv entries'
    )
  })

  test('every home directory reaches security byte for byte, one argv entry', () => {
    // No escaping is applied or needed: argv is not a shell command line, so a
    // quote or `&` in the name is just a character. What used to break was the
    // concatenation, so pin that the shape never changes and nothing is lost.
    for (const home of homes) {
      const args = buildMacArgs(home)
      assert.equal(args.length, 6, `argv shape changed for ${home}`)
      assert.equal(
        args[args.length - 1],
        join(home, 'Library/Keychains/login.keychain-db'),
        `path mangled for ${home}`
      )
    }
  })

  test('covers the system root keychain and the system keychain', () => {
    const args = buildMacArgs('/Users/zx')
    assert.ok(args.includes('/System/Library/Keychains/SystemRootCertificates.keychain'))
    assert.ok(args.includes('/Library/Keychains/System.keychain'))
  })
})

describe('buildWinArgs', () => {
  test('delivers the script as a single base64 argv entry', () => {
    const args = buildWinArgs()
    assert.deepEqual(
      args.slice(0, 4),
      ['-NoLogo', '-NonInteractive', '-NoProfile', '-EncodedCommand']
    )
    assert.equal(args.length, 5)
    assert.equal(decode(args[4]), WIN_CA_SCRIPT)
  })

  test('no argv entry carries a quote or cmd.exe metacharacter', () => {
    for (const arg of buildWinArgs()) {
      assert.doesNotMatch(arg, /["'`$&|<>^%]/)
    }
  })

  test('dumps the machine and user root/intermediate stores', () => {
    const stores = [
      'Cert:\\LocalMachine\\Root',
      'Cert:\\LocalMachine\\CA',
      'Cert:\\CurrentUser\\Root',
      'Cert:\\CurrentUser\\CA'
    ]
    for (const s of stores) {
      assert.ok(WIN_CA_SCRIPT.includes(s), `missing store ${s}`)
    }
    assert.ok(WIN_CA_SCRIPT.includes('-----BEGIN CERTIFICATE-----'))
  })
})
