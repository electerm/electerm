const { test } = require('node:test')
const assert = require('node:assert/strict')
const { proxyAddress } = require('../../app/server/socks')

test('ipv4 proxy hosts are passed as ipaddress', () => {
  assert.deepEqual(proxyAddress(new URL('socks5://127.0.0.1:1080').hostname), { ipaddress: '127.0.0.1' })
})

test('ipv6 proxy hosts lose the URL brackets and count as ipaddress', () => {
  assert.deepEqual(proxyAddress(new URL('socks5://[::1]:1080').hostname), { ipaddress: '::1' })
  assert.deepEqual(proxyAddress(new URL('socks5://u:p@[fe80::1]:1080').hostname), { ipaddress: 'fe80::1' })
  assert.deepEqual(
    proxyAddress(new URL('socks4://[2001:db8:85a3::8a2e:370:7334]:1080').hostname),
    { ipaddress: '2001:db8:85a3::8a2e:370:7334' }
  )
})

test('names are passed as host', () => {
  assert.deepEqual(proxyAddress(new URL('socks5://proxy.example.com:1080').hostname), { host: 'proxy.example.com' })
})
