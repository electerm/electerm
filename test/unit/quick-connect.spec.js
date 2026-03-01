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
} = require('../../src/app/common/parse-quick-connect')

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
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, undefined)
  })

  test('should parse ssh://user:password@host', () => {
    const result = parseQuickConnect('ssh://user:password@192.168.1.100:22')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
    assert.strictEqual(result.port, 22)
  })

  test('should parse ssh://host (without username)', () => {
    const result = parseQuickConnect('ssh://192.168.1.100')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, undefined)
  })

  test('should parse ssh://host:port', () => {
    const result = parseQuickConnect('ssh://192.168.1.100:2222')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 2222)
  })

  // Test SSH shortcut format
  test('should parse user@host (shortcut)', () => {
    const result = parseQuickConnect('user@192.168.1.100')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
  })

  test('should parse user@host:port (shortcut)', () => {
    const result = parseQuickConnect('user@192.168.1.100:2222')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 2222)
  })

  test('should parse host (shortcut)', () => {
    const result = parseQuickConnect('192.168.1.100')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  test('should parse host:port (shortcut)', () => {
    const result = parseQuickConnect('192.168.1.100:2222')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 2222)
  })

  // Test SSH shortcut format with hostname containing colon
  test('should parse hostname:port with letters (shortcut)', () => {
    const result = parseQuickConnect('localhost:23344')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, 'localhost')
    assert.strictEqual(result.port, 23344)
  })

  test('should parse hostname:port with multiple labels (shortcut)', () => {
    const result = parseQuickConnect('my-server:23344')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, 'my-server')
    assert.strictEqual(result.port, 23344)
  })

  test('should parse user@hostname:port (shortcut)', () => {
    const result = parseQuickConnect('user@localhost:23344')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, 'localhost')
    assert.strictEqual(result.port, 23344)
    assert.strictEqual(result.username, 'user')
  })

  // Test Telnet protocol
  test('should parse telnet://user@host', () => {
    const result = parseQuickConnect('telnet://user@192.168.1.1:23')
    assert.strictEqual(result.type, 'telnet')
    assert.strictEqual(result.host, '192.168.1.1')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 23)
  })

  test('should parse telnet://host', () => {
    const result = parseQuickConnect('telnet://192.168.1.1')
    assert.strictEqual(result.type, 'telnet')
    assert.strictEqual(result.host, '192.168.1.1')
  })

  // Test VNC protocol
  test('should parse vnc://user@host', () => {
    const result = parseQuickConnect('vnc://user@192.168.1.100:5900')
    assert.strictEqual(result.type, 'vnc')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 5900)
  })

  test('should parse vnc://host', () => {
    const result = parseQuickConnect('vnc://192.168.1.100')
    assert.strictEqual(result.type, 'vnc')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  // Test RDP protocol
  test('should parse rdp://user@host', () => {
    const result = parseQuickConnect('rdp://admin@192.168.1.100:3389')
    assert.strictEqual(result.type, 'rdp')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'admin')
    assert.strictEqual(result.port, 3389)
  })

  test('should parse rdp://host', () => {
    const result = parseQuickConnect('rdp://192.168.1.100')
    assert.strictEqual(result.type, 'rdp')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  // Test Spice protocol
  test('should parse spice://host', () => {
    const result = parseQuickConnect('spice://192.168.1.100:5900')
    assert.strictEqual(result.type, 'spice')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 5900)
  })

  test('should parse spice://password:host', () => {
    const result = parseQuickConnect('spice://password:192.168.1.100:5900')
    assert.strictEqual(result.type, 'spice')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.password, 'password')
    assert.strictEqual(result.port, 5900)
  })

  // Test Serial protocol
  test('should parse serial://COM1', () => {
    const result = parseQuickConnect('serial://COM1')
    assert.strictEqual(result.type, 'serial')
    assert.strictEqual(result.path, 'COM1')
  })

  test('should parse serial://COM1?baudRate=115200', () => {
    const result = parseQuickConnect('serial://COM1?baudRate=115200')
    assert.strictEqual(result.type, 'serial')
    assert.strictEqual(result.path, 'COM1')
    assert.strictEqual(result.baudRate, 115200)
  })

  test('should parse serial:///dev/ttyUSB0?baudRate=9600', () => {
    const result = parseQuickConnect('serial:///dev/ttyUSB0?baudRate=9600')
    assert.strictEqual(result.type, 'serial')
    assert.strictEqual(result.path, '/dev/ttyUSB0')
    assert.strictEqual(result.baudRate, 9600)
  })

  // Test FTP protocol
  test('should parse ftp://user@host', () => {
    const result = parseQuickConnect('ftp://user@ftp.example.com:21')
    assert.strictEqual(result.type, 'ftp')
    assert.strictEqual(result.host, 'ftp.example.com')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 21)
  })

  test('should parse ftp://user:password@host', () => {
    const result = parseQuickConnect('ftp://user:password@ftp.example.com:21')
    assert.strictEqual(result.type, 'ftp')
    assert.strictEqual(result.host, 'ftp.example.com')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
  })

  // Test HTTP/HTTPS protocols
  test('should parse http://host', () => {
    const result = parseQuickConnect('http://192.168.1.100:8080')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'http://192.168.1.100:8080')
  })

  test('should parse https://host', () => {
    const result = parseQuickConnect('https://192.168.1.100:8443')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'https://192.168.1.100:8443')
  })

  test('should parse https://example.com', () => {
    const result = parseQuickConnect('https://example.com')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'https://example.com')
  })

  test('should parse http://host?query params', () => {
    const result = parseQuickConnect('http://example.com?key=value&foo=bar')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'http://example.com?key=value&foo=bar')
  })

  test('should parse https://host?title=xxx', () => {
    const result = parseQuickConnect('https://example.com?title=MyPage&type=web')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'https://example.com?title=MyPage&type=web')
  })

  // Test opts parameter
  test('should parse opts with single quotes', () => {
    const result = parseQuickConnect("ssh://user@host:22?opts='{\"title\": \"My Server\"}'")
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.title, 'My Server')
  })

  test('should parse opts with double quotes', () => {
    const result = parseQuickConnect('ssh://user@host:22?opts={"title": "My Server"}')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.title, 'My Server')
  })

  test('should parse opts and merge with other params', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100:22?title=MyServer&opts={"title":"MyServer","username":"user","password":"password"}')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
    assert.strictEqual(result.title, 'MyServer')
  })

  // Test sshTunnels via opts
  test('should parse sshTunnels from opts', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100:22?opts={"sshTunnels":[{"sshTunnel":"forwardLocalToRemote","sshTunnelLocalPort":8080,"sshTunnelRemoteHost":"localhost","sshTunnelRemotePort":80}]}')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.port, 22)
    assert.deepStrictEqual(result.sshTunnels, [{
      sshTunnel: 'forwardLocalToRemote',
      sshTunnelLocalPort: 8080,
      sshTunnelRemoteHost: 'localhost',
      sshTunnelRemotePort: 80
    }])
  })

  // Test connectionHoppings via opts
  test('should parse connectionHoppings from opts', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100:22?opts={"connectionHoppings":[{"host":"192.168.1.101","port":22,"username":"user2","password":"pass2"}]}')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.deepStrictEqual(result.connectionHoppings, [{
      host: '192.168.1.101',
      port: 22,
      username: 'user2',
      password: 'pass2'
    }])
  })

  // Test both sshTunnels and connectionHoppings together
  test('should parse both sshTunnels and connectionHoppings from opts', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100?opts={"sshTunnels":[{"sshTunnel":"dynamicForward","sshTunnelLocalPort":1080}],"connectionHoppings":[{"host":"jump.host","port":22,"username":"jumper"}]}')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.sshTunnels.length, 1)
    assert.strictEqual(result.sshTunnels[0].sshTunnel, 'dynamicForward')
    assert.strictEqual(result.sshTunnels[0].sshTunnelLocalPort, 1080)
    assert.strictEqual(result.connectionHoppings.length, 1)
    assert.strictEqual(result.connectionHoppings[0].host, 'jump.host')
    assert.strictEqual(result.connectionHoppings[0].username, 'jumper')
  })

  // Test SSH default values (enableSsh, enableSftp, useSshAgent, term, encode, envLang)
  test('should add default values for SSH type', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.enableSsh, true)
    assert.strictEqual(result.enableSftp, true)
    assert.strictEqual(result.useSshAgent, true)
    assert.strictEqual(result.term, 'xterm-256color')
    assert.strictEqual(result.encode, 'utf-8')
    assert.strictEqual(result.envLang, 'en_US.UTF-8')
  })

  // Test VNC default values
  test('should add default values for VNC type', () => {
    const result = parseQuickConnect('vnc://192.168.1.100')
    assert.strictEqual(result.type, 'vnc')
    assert.strictEqual(result.scaleViewport, true)
  })

  // Test RDP default values
  test('should add default values for RDP type', () => {
    const result = parseQuickConnect('rdp://192.168.1.100')
    assert.strictEqual(result.type, 'rdp')
  })

  // Test Serial default values
  test('should add default values for Serial type', () => {
    const result = parseQuickConnect('serial://COM1')
    assert.strictEqual(result.type, 'serial')
    assert.strictEqual(result.baudRate, 9600)
    assert.strictEqual(result.dataBits, 8)
    assert.strictEqual(result.stopBits, 1)
    assert.strictEqual(result.parity, 'none')
  })

  // Test Telnet default port
  test('should add default port for Telnet type', () => {
    const result = parseQuickConnect('telnet://192.168.1.1')
    assert.strictEqual(result.type, 'telnet')
    assert.strictEqual(result.port, 23)
  })

  // Test with title query param
  test('should parse title from query param', () => {
    const result = parseQuickConnect('ssh://user@192.168.1.100:22?title=MyServer')
    assert.strictEqual(result.type, 'ssh')
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

  test('should have electerm default port', () => {
    assert.strictEqual(DEFAULT_PORTS.electerm, 22)
  })
})

describe('electerm:// protocol', function () {
  // Test electerm:// with default type (ssh)
  test('should parse electerm://host (default type ssh)', () => {
    const result = parseQuickConnect('electerm://192.168.1.100')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  test('should parse electerm://user@host', () => {
    const result = parseQuickConnect('electerm://user@192.168.1.100')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.username, 'user')
  })

  test('should parse electerm://user:password@host:port', () => {
    const result = parseQuickConnect('electerm://user:password@192.168.1.100:22')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 22)
    assert.strictEqual(result.username, 'user')
    assert.strictEqual(result.password, 'password')
  })

  // Test electerm:// with type query param
  test('should parse electerm://host?type=telnet', () => {
    const result = parseQuickConnect('electerm://192.168.1.1?type=telnet')
    assert.strictEqual(result.type, 'telnet')
    assert.strictEqual(result.host, '192.168.1.1')
  })

  test('should parse electerm://host?type=vnc', () => {
    const result = parseQuickConnect('electerm://192.168.1.100?type=vnc')
    assert.strictEqual(result.type, 'vnc')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  test('should parse electerm://host?type=rdp', () => {
    const result = parseQuickConnect('electerm://192.168.1.100?type=rdp')
    assert.strictEqual(result.type, 'rdp')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  test('should parse electerm://host?type=serial', () => {
    const result = parseQuickConnect('electerm://COM1?type=serial')
    assert.strictEqual(result.type, 'serial')
    assert.strictEqual(result.path, 'COM1')
  })

  test('should parse electerm://host?type=spice', () => {
    const result = parseQuickConnect('electerm://192.168.1.100?type=spice')
    assert.strictEqual(result.type, 'spice')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  // Test electerm:// with tp query param (alias for type)
  test('should parse electerm://host?tp=vnc', () => {
    const result = parseQuickConnect('electerm://192.168.1.100?tp=vnc')
    assert.strictEqual(result.type, 'vnc')
    assert.strictEqual(result.host, '192.168.1.100')
  })

  // Test electerm:// with port
  test('should parse electerm://host:port?type=ssh', () => {
    const result = parseQuickConnect('electerm://192.168.1.100:2222?type=ssh')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.port, 2222)
  })

  // Test electerm:// with title query param
  test('should parse electerm://host?type=ssh&title=MyServer', () => {
    const result = parseQuickConnect('electerm://192.168.1.100?type=ssh&title=MyServer')
    assert.strictEqual(result.type, 'ssh')
    assert.strictEqual(result.host, '192.168.1.100')
    assert.strictEqual(result.title, 'MyServer')
  })

  // Test electerm:// with username and type
  test('should parse electerm://user@host:port?type=telnet', () => {
    const result = parseQuickConnect('electerm://admin@192.168.1.1:23?type=telnet')
    assert.strictEqual(result.type, 'telnet')
    assert.strictEqual(result.host, '192.168.1.1')
    assert.strictEqual(result.port, 23)
    assert.strictEqual(result.username, 'admin')
  })

  // Test electerm:// with web type
  test('should parse electerm://host?type=https', () => {
    const result = parseQuickConnect('electerm://example.com?type=https')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'https://example.com')
  })

  test('should parse electerm://host:port?type=http', () => {
    const result = parseQuickConnect('electerm://example.com:8080?type=http')
    assert.strictEqual(result.type, 'web')
    assert.strictEqual(result.url, 'http://example.com:8080')
  })

  // Test electerm:// with invalid type
  test('should return null for electerm://host?type=invalid', () => {
    const result = parseQuickConnect('electerm://192.168.1.100?type=invalid')
    assert.strictEqual(result, null)
  })

  // Test electerm:// with serial baudRate
  test('should parse electerm://COM1?type=serial&baudRate=115200', () => {
    const result = parseQuickConnect('electerm://COM1?type=serial&baudRate=115200')
    assert.strictEqual(result.type, 'serial')
    assert.strictEqual(result.path, 'COM1')
    assert.strictEqual(result.baudRate, 115200)
  })
})
