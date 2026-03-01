/**
 * Quick Connect Parser Tests
 * Uses Node.js built-in test function (node:test)
 */

const { test, describe } = require('node:test')
const assert = require('node:assert')
const {
  parseQuickConnect,
  getDefaultPort,
  getSupportedProtocols,
  SUPPORTED_PROTOCOLS,
  DEFAULT_PORTS
} = require('../../src/client/store/parse-quick-connect')

describe('parseQuickConnect', function () {
  // Test null/undefined/empty input
  test('should return null for null input', () => {
    assert.strictEqual(parseQuickConnect(null), null)
  })

  test('should return null for undefined input', () => {
    assert.strictEqual(parseQuickConnect(undefined), null)
  })

  test('should return null for empty string', () => {
    assert.strictEqual(parseQuickConnect(''), null)
  })

  test('should return null for whitespace only', () => {
    assert.strictEqual(parseQuickConnect('   '), null)
  })

  // Test SSH protocol
  test('should parse ssh://user@host', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, undefined)
  })

  test('should parse ssh://user:password@host', () => {
    const result = parseQuickConnect('ssh://user:password@192.168.1.100:22')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
    assert.strictEqual(result.port, 22)
  })

  test('should parse ssh://host (without username)', () => {
    const result = parseQuickConnect('ssh://192.168.1.100')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, undefined)
  })

  test('should parse ssh://host:port', () => {
    const result = parseQuickConnect('ssh://192.168.1.100:2222')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 2222)
  })

  // Test SSH shortcut format
  test('should parse user@host (shortcut)', () => {
    const result = parseQuickConnect('user@192.168.1.100')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
  })

  test('should parse user@host:port (shortcut)', () => {
    const result = parseQuickConnect('user@192.168.1.100:2222')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 2222)
  })

  test('should parse host (shortcut)', () => {
    const result = parseQuickConnect('192.168.1.100')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  test('should parse host:port (shortcut)', () => {
    const result = parseQuickConnect('192.168.1.100:2222')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 2222)
  })

  // Test Telnet protocol
  test('should parse telnet://user@host', () => {
    const result = parseQuickConnect('telnet://user@192.168.1.1:23')
    assert.strictEqual(result.tp, 'telnet')
    assert.strictEqual(result.host, '192.168.1.1')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 23)
  })

  test('should parse telnet://host', () => {
    const result = parseQuickConnect('telnet://192.168.1.1')
    assert.strictEqual(result.tp, 'telnet')
    assert.strictEqual(result.host, '192.168.1.1')
  })

  // Test VNC protocol
  test('should parse vnc://user@host', () => {
    const result = parseQuickConnect('vnc://user@192.168.1.100:5900')
    assert.strictEqual(result.tp, 'vnc')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 5900)
  })

  test('should parse vnc://host', () => {
    const result = parseQuickConnect('vnc://192.168.1.100')
    assert.strictEqual(result.tp, 'vnc')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  // Test RDP protocol
  test('should parse rdp://user@host', () => {
    const result = parseQuickConnect('rdp://admin@192.168.1.100:3389')
    assert.strictEqual(result.tp, 'rdp')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'admin')
    assert.strictEqual(result.port, 3389)
  })

  test('should parse rdp://host', () => {
    const result = parseQuickConnect('rdp://192.168.1.100')
    assert.strictEqual(result.tp, 'rdp')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  // Test Spice protocol
  test('should parse spice://host', () => {
    const result = parseQuickConnect('spice://192.168.1.100:5900')
    assert.strictEqual(result.tp, 'spice')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 5900)
  })

  test('should parse spice://password:host', () => {
    const result = parseQuickConnect('spice://password:192.168.1.100:5900')
    assert.strictEqual(result.tp, 'spice')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.password, 'password')
    assert.strictEqual(result.port, 5900)
  })

  // Test Serial protocol
  test('should parse serial://COM1', () => {
    const result = parseQuickConnect('serial://COM1')
    assert.strictEqual(result.tp, 'serial')
    assert.strictEqual(result.path, 'COM1')
  })

  test('should parse serial://COM1?baudRate=115200', () => {
    const result = parseQuickConnect('serial://COM1?baudRate=115200')
    assert.strictEqual(result.tp, 'serial')
    assert.strictEqual(result.path, 'COM1')
    assert.strictEqual(result.baudRate, 115200)
  })

  test('should parse serial:///dev/ttyUSB0?baudRate=9600', () => {
    const result = parseQuickConnect('serial:///dev/ttyUSB0?baudRate=9600')
    assert.strictEqual(result.tp, 'serial')
    assert.strictEqual(result.path, '/dev/ttyUSB0')
    assert.strictEqual(result.baudRate, 9600)
  })

  // Test FTP protocol
  test('should parse ftp://user@host', () => {
    const result = parseQuickConnect('ftp://user@ftp.example.com:21')
    assert.strictEqual(result.tp, 'ftp')
    assert.strictEqual(result.host, 'ftp.example.com')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 21)
  })

  test('should parse ftp://user:password@host', () => {
    const result = parseQuickConnect('ftp://user:password@ftp.example.com:21')
    assert.strictEqual(result.tp, 'ftp')
    assert.strictEqual(result.host, 'ftp.example.com')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
  })

  // Test HTTP/HTTPS protocols
  test('should parse http://host', () => {
    const result = parseQuickConnect('http://192.168.1.100:8080')
    assert.strictEqual(result.tp, 'web')
    assert.strictEqual(result.url, 'http://192.168.1.100:8080')
  })

  test('should parse https://host', () => {
    const result = parseQuickConnect('https://192.168.1.100:8443')
    assert.strictEqual(result.tp, 'web')
    assert.strictEqual(result.url, 'https://192.168.1.100:8443')
  })

  test('should parse https://example.com', () => {
    const result = parseQuickConnect('https://example.com')
    assert.strictEqual(result.tp, 'web')
    assert.strictEqual(result.url, 'https://example.com')
  })

  test('should parse http://host?query params', () => {
    const result = parseQuickConnect('http://example.com?key=value&foo=bar')
    assert.strictEqual(result.tp, 'web')
    assert.strictEqual(result.url, 'http://example.com?key=value&foo=bar')
  })

  test('should parse https://host?title=xxx', () => {
    const result = parseQuickConnect('https://example.com?title=MyPage&type=web')
    assert.strictEqual(result.tp, 'web')
    assert.strictEqual(result.url, 'https://example.com?title=MyPage&type=web')
  })

  // Test opts parameter
  test('should parse opts with single quotes', () => {
    const result = parseQuickConnect("ssh://user@host:22?opts='{\"title\": \"My Server\"}'")
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.title, 'My Server')
  })

  test('should parse opts with double quotes', () => {
    const result = parseQuickConnect('ssh://user@host:22?opts={"title": "My Server"}')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.title, 'My Server')
  })

  test('should parse opts and merge with other params', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100:22?title=MyServer&opts={"title":"MyServer","username":"user","password":"password"}')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
    assert.strictEqual(result.title, 'MyServer')
  })

  // Test with title query param
  test('should parse title from query param', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100:22?title=MyServer')
    assert.strictEqual(result.tp, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.title, 'MyServer')
  })

  // Test invalid inputs
  test('should return null for unsupported protocol', () => {
    const result = parseQuickConnect('unsupported://host')
    assert.strictEqual(result, null)
  })

  test('should return null for invalid format', () => {
    // Truly invalid format that can't be parsed
    const result = parseQuickConnect('://host')
    assert.strictEqual(result, null)
  })

  test('should handle protocol without host', () => {
    const result = parseQuickConnect('ssh://')
    assert.strictEqual(result, null)
  })
})

describe('getDefaultPort', function () {
  test('should return correct default port for ssh', () => {
    assert.strictEqual(getDefaultPort('ssh'), 22)
  })

  test('should return correct default port for telnet', () => {
    assert.strictEqual(getDefaultPort('telnet'), 23)
  })

  test('should return correct default port for vnc', () => {
    assert.strictEqual(getDefaultPort('vnc'), 5900)
  })

  test('should return correct default port for rdp', () => {
    assert.strictEqual(getDefaultPort('rdp'), 3389)
  })

  test('should return correct default port for spice', () => {
    assert.strictEqual(getDefaultPort('spice'), 5900)
  })

  test('should return correct default port for ftp', () => {
    assert.strictEqual(getDefaultPort('ftp'), 21)
  })

  test('should return correct default port for http', () => {
    assert.strictEqual(getDefaultPort('http'), 80)
  })

  test('should return correct default port for https', () => {
    assert.strictEqual(getDefaultPort('https'), 443)
  })

  test('should return undefined for serial', () => {
    assert.strictEqual(getDefaultPort('serial'), undefined)
  })
})

describe('getSupportedProtocols', function () {
  test('should return array of supported protocols', () => {
    const protocols = getSupportedProtocols()
    assert(Array.isArray(protocols))
    assert(protocols.includes('ssh'))
    assert(protocols.includes('telnet'))
    assert(protocols.includes('vnc'))
    assert(protocols.includes('rdp'))
    assert(protocols.includes('spice'))
    assert(protocols.includes('serial'))
    assert(protocols.includes('ftp'))
    assert(protocols.includes('http'))
    assert(protocols.includes('https'))
  })
})

describe('SUPPORTED_PROTOCOLS', function () {
  test('should include all expected protocols', () => {
    assert(SUPPORTED_PROTOCOLS.includes('ssh'))
    assert(SUPPORTED_PROTOCOLS.includes('telnet'))
    assert(SUPPORTED_PROTOCOLS.includes('vnc'))
    assert(SUPPORTED_PROTOCOLS.includes('rdp'))
    assert(SUPPORTED_PROTOCOLS.includes('spice'))
    assert(SUPPORTED_PROTOCOLS.includes('serial'))
    assert(SUPPORTED_PROTOCOLS.includes('ftp'))
    assert(SUPPORTED_PROTOCOLS.includes('http'))
    assert(SUPPORTED_PROTOCOLS.includes('https'))
  })
})

describe('DEFAULT_PORTS', function () {
  test('should have correct default ports', () => {
    assert.strictEqual(DEFAULT_PORTS.ssh, 22)
    assert.strictEqual(DEFAULT_PORTS.telnet, 23)
    assert.strictEqual(DEFAULT_PORTS.vnc, 5900)
    assert.strictEqual(DEFAULT_PORTS.rdp, 3389)
    assert.strictEqual(DEFAULT_PORTS.spice, 5900)
    assert.strictEqual(DEFAULT_PORTS.ftp, 21)
    assert.strictEqual(DEFAULT_PORTS.http, 80)
    assert.strictEqual(DEFAULT_PORTS.https, 443)
  })
})
