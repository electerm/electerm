/**
 * Deep link / quick connect input is untrusted: it arrives from a clicked
 * electerm:// or ssh:// link, from argv, or from a shortcut file, and parsing
 * must not let it set any field that reaches a process spawn, a shell, the
 * process environment or the terminal input stream.
 *
 * Regression coverage for the `proxyCommand` bypass of the denylists added for
 * GHSA-mpm8-cx2p-626q. A clicked deep link reached child_process.spawn() through
 * server/ssh-proxy-command.js before any SSH authentication, both directly and
 * nested inside a connectionHoppings entry.
 * See temp/security/deeplink-proxycommand-verification.md.
 *
 * The guard is a denylist on purpose: a quick connect string may legitimately
 * carry any session option, so an allowlist would silently break fields it does
 * not know about. The tests below pin BOTH halves of that contract - dangerous
 * fields are dropped, and everything else (including a field this file has
 * never heard of) still gets through.
 *
 * Lives in unit-ci/ because src/test/unit/ is not wired into any npm script or
 * workflow - a suite there does not run in CI.
 */

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')

const {
  parseQuickConnect,
  OPTS_DENY_LIST,
  DANGEROUS_SESSION_FIELDS
} = require('../../app/common/parse-quick-connect')

const withOpts = opts =>
  'electerm://127.0.0.1:2222?opts=' + JSON.stringify(opts)

// every session field known to reach child_process.spawn / a shell / env / tty
const EXEC_FIELDS = [
  'proxyCommand',
  'runScripts',
  'execLinux',
  'execMac',
  'execWindows',
  'execLinuxArgs',
  'execMacArgs',
  'execWindowsArgs',
  'setEnv',
  'interactiveValues',
  'triggers'
]

describe('deep link surface: unsafe fields are dropped', function () {
  test('drops proxyCommand set by a deep link', () => {
    const result = parseQuickConnect(withOpts({
      username: 'x',
      password: 'x',
      proxyCommand: '/bin/sh -c id'
    }))
    assert.strictEqual(result.username, 'x')
    assert.ok(!('proxyCommand' in result), 'proxyCommand must not survive parsing')
  })

  EXEC_FIELDS.forEach(field => {
    test(`drops ${field} set by a deep link`, () => {
      const result = parseQuickConnect(withOpts({ [field]: 'pwn' }))
      assert.ok(!(field in result), `${field} must not survive parsing`)
    })
  })

  test('cannot override type or host via opts', () => {
    const result = parseQuickConnect(withOpts({ type: 'local', host: 'evil.host' }))
    assert.strictEqual(result.host, '127.0.0.1')
    assert.strictEqual(result.type, 'ssh')
  })

  test('applies the same guard to the ssh:// scheme', () => {
    const result = parseQuickConnect(
      'ssh://user@192.168.1.100:22?opts=' +
      JSON.stringify({ proxyCommand: '/bin/sh -c id' })
    )
    assert.strictEqual(result.host, '192.168.1.100')
    assert.ok(!('proxyCommand' in result))
  })
})

/**
 * The other half of the contract. An earlier revision of this fix used an
 * allowlist and silently dropped these, which would have broken existing shared
 * links - these tests exist so that cannot happen again.
 */
describe('deep link surface: safe fields still get through', function () {
  const SAFE_FIELDS = [
    'title',
    'username',
    'user',
    'password',
    'port',
    'encode',
    'envLang',
    'term',
    'authType',
    'agentForward',
    'useSshAgent',
    'enableSsh',
    'enableSftp',
    'keepaliveInterval',
    'readyTimeout',
    'startDirectoryRemote',
    'startDirectoryLocal',
    'description',
    'profile',
    'privateKey',
    'passphrase',
    'sshTunnels',
    'connectionHoppings'
  ]

  test('keeps every documented safe field', () => {
    const opts = {}
    SAFE_FIELDS.forEach(f => {
      opts[f] = f === 'port' ? 2222 : 'value'
    })
    const result = parseQuickConnect(withOpts(opts))
    SAFE_FIELDS.forEach(f => {
      assert.ok(f in result, `${f} must survive parsing`)
    })
  })

  test('keeps a field the guard has never heard of', () => {
    // documents the deliberate denylist trade-off: unknown options pass through
    const result = parseQuickConnect(withOpts({ someFutureOption: 'kept' }))
    assert.strictEqual(result.someFutureOption, 'kept')
  })

  test('still accepts sshTunnels and connectionHoppings as objects', () => {
    const result = parseQuickConnect(withOpts({
      sshTunnels: [{ sshTunnel: 'dynamicForward', sshTunnelLocalPort: 1080 }],
      connectionHoppings: [{ host: 'jump.host', port: 22, username: 'j' }]
    }))
    assert.strictEqual(result.sshTunnels.length, 1)
    assert.strictEqual(result.connectionHoppings.length, 1)
    assert.strictEqual(result.connectionHoppings[0].host, 'jump.host')
  })
})

describe('deep link surface: connectionHoppings is filtered too', function () {
  // a hop entry is spread into a sub-session (server/session-hop.js), so it is
  // its own untrusted surface
  test('drops proxyCommand nested in a hop entry', () => {
    const result = parseQuickConnect(withOpts({
      connectionHoppings: [{
        host: '127.0.0.1',
        port: 2222,
        username: 'x',
        password: 'x',
        proxyCommand: '/bin/sh -c id'
      }]
    }))
    assert.strictEqual(result.connectionHoppings.length, 1)
    assert.strictEqual(result.connectionHoppings[0].host, '127.0.0.1')
    assert.ok(
      !('proxyCommand' in result.connectionHoppings[0]),
      'a hop must not carry proxyCommand into its sub-session'
    )
  })

  EXEC_FIELDS.forEach(field => {
    test(`drops ${field} nested in a hop entry`, () => {
      const result = parseQuickConnect(withOpts({
        connectionHoppings: [{ host: 'h', [field]: 'pwn' }]
      }))
      assert.ok(
        !(field in result.connectionHoppings[0]),
        `${field} must not survive inside a hop`
      )
    })
  })

  test('keeps the documented hop fields', () => {
    const hop = {
      host: 'jump.host',
      port: 22,
      username: 'j',
      password: 'p',
      privateKey: 'key',
      passphrase: 'pass',
      certificate: 'cert',
      authType: 'password',
      profile: 'profile-id'
    }
    const result = parseQuickConnect(withOpts({ connectionHoppings: [hop] }))
    assert.deepEqual(result.connectionHoppings[0], hop)
  })

  test('drops non-object hop entries', () => {
    const result = parseQuickConnect(withOpts({
      connectionHoppings: ['nope', null, 42, { host: 'ok' }]
    }))
    assert.deepEqual(result.connectionHoppings, [{ host: 'ok' }])
  })

  test('applies the guard to the rdp:// scheme too', () => {
    const result = parseQuickConnect(
      'rdp://192.168.1.100:3389?opts=' +
      JSON.stringify({
        proxyCommand: '/bin/sh -c id',
        connectionHoppings: [{ host: 'h', proxyCommand: '/bin/sh -c id' }]
      })
    )
    assert.strictEqual(result.type, 'rdp')
    assert.ok(!('proxyCommand' in result))
    assert.deepEqual(result.connectionHoppings, [{ host: 'h' }])
  })
})

/**
 * The guard used to be five separate copies and they had drifted: proxyCommand
 * was in none of them and 'triggers' was in tab.js but not in the two MCP
 * mirrors. Everything now imports one shared list; these tests fail on the next
 * copy that appears.
 */
describe('the dangerous-field guard is single sourced', function () {
  const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8')

  const GUARD_FILES = [
    'src/client/store/tab.js',
    'src/client/store/mcp-handler.js',
    'src/app/widgets/widget-mcp-server.js'
  ]

  test('no tab guard keeps a private copy of the list', () => {
    for (const file of GUARD_FILES) {
      assert.ok(
        !/const dangerousTabProps = \[/.test(read(file)),
        `${file} must not define its own dangerousTabProps array`
      )
      assert.ok(
        /dangerous-session-fields/.test(read(file)),
        `${file} must import the shared dangerous field list`
      )
    }
  })

  test('the two dangerous-session-fields copies are identical', () => {
    const normalize = src => src
      .replace(/^module\.exports = \[/m, '[')
      .replace(/^export default \[/m, '[')
    assert.strictEqual(
      normalize(read('src/client/common/dangerous-session-fields.js')),
      normalize(read('src/app/common/dangerous-session-fields.js')),
      'the app and client dangerous field lists have drifted'
    )
  })

  test('the two parse-quick-connect copies are identical except for module syntax', () => {
    const normalize = src => src
      .replace(/^const DANGEROUS_SESSION_FIELDS = require\('\.\/dangerous-session-fields'\)$/m, '')
      .replace(/^import DANGEROUS_SESSION_FIELDS from '\.\/dangerous-session-fields'$/m, '')
      .replace(/^module\.exports = \{/m, '')
      .replace(/^export \{/m, '')
    assert.strictEqual(
      normalize(read('src/client/common/parse-quick-connect.js')),
      normalize(read('src/app/common/parse-quick-connect.js')),
      'src/app/common and src/client/common parse-quick-connect.js have drifted'
    )
  })

  test('the shared list covers every known exec-capable field', () => {
    for (const field of EXEC_FIELDS) {
      assert.ok(
        DANGEROUS_SESSION_FIELDS.includes(field),
        `${field} is missing from the shared dangerous field list`
      )
    }
  })

  test('OPTS_DENY_LIST is the shared list plus the URL-owned fields', () => {
    assert.ok(OPTS_DENY_LIST.includes('type'))
    assert.ok(OPTS_DENY_LIST.includes('host'))
    for (const field of DANGEROUS_SESSION_FIELDS) {
      assert.ok(OPTS_DENY_LIST.includes(field), `${field} missing from OPTS_DENY_LIST`)
    }
  })

  test('session-hop strips the shared list from a hop before spreading it', () => {
    const src = read('src/app/server/session-hop.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    assert.ok(
      !/\.\.\.\s*hop\b/.test(src),
      'session-hop.js must not spread a raw hop object'
    )
    assert.ok(/dangerous-session-fields/.test(src))
  })
})
