/**
 * A proxy given by IPv6 address did not work over either proxy type: a URL
 * hostname keeps the brackets around the literal ('[::1]'), and both branches
 * handed that string to something that resolves it as a name -- net.connect
 * for socks, dns.lookup through http.request for an http proxy -- so it died
 * with `getaddrinfo ENOTFOUND [::1]`.
 *
 * #4643 fixed the socks branch. The http branch is covered here too, and both
 * are exercised against a real listener on ::1 rather than against the option
 * object, because the bracket only breaks on the way to the socket: a test of
 * proxyAddress() alone still passes with the fix unwired from `options.proxy`.
 */

const { test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('net')
const { once } = require('events')

const socks = require('../../app/server/socks')
const { proxyAddress } = socks

const V6 = '::1'

function listen (onConnection, host = V6) {
  return new Promise((resolve, reject) => {
    const server = net.createServer(socket => {
      socket.on('error', () => {})
      onConnection(socket)
    })
    server.once('error', reject)
    server.listen(0, host, () => resolve({ server, port: server.address().port }))
  })
}

function close (server) {
  return new Promise(resolve => server.close(resolve))
}

// answers the no-auth handshake and the CONNECT request, then says hello
function startSocks5Proxy () {
  const seen = []
  return listen(socket => {
    socket.once('data', () => {
      socket.write(Buffer.from([5, 0]))
      socket.once('data', chunk => {
        seen.push(chunk)
        socket.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]))
        socket.write('connected')
      })
    })
  }).then(proxy => ({ ...proxy, seen }))
}

// answers CONNECT and keeps the request line, so the Host header can be checked
function startHttpProxy (host = V6) {
  const seen = []
  return listen(socket => {
    socket.once('data', chunk => {
      seen.push(chunk.toString())
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\nconnected')
    })
  }, host).then(proxy => ({ ...proxy, seen }))
}

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

test('a socks5 proxy given by ipv6 address is reachable', async () => {
  const proxy = await startSocks5Proxy()
  try {
    const { socket } = await socks({
      host: 'example.com',
      port: 80,
      proxy: `socks5://[${V6}]:${proxy.port}`,
      readyTimeout: 5000
    })
    const [data] = await once(socket, 'data')
    socket.destroy()
    assert.equal(data.toString(), 'connected')
    assert.ok(proxy.seen[0].includes('example.com'), 'CONNECT reached the proxy')
  } finally {
    await close(proxy.server)
  }
})

test('an http proxy given by ipv6 address is reachable, with a bracketed Host header', async () => {
  const proxy = await startHttpProxy()
  try {
    const { socket } = await socks({
      host: 'example.com',
      port: 80,
      proxy: `http://[${V6}]:${proxy.port}`,
      readyTimeout: 5000
    })
    socket.destroy()
    assert.match(proxy.seen[0], /^CONNECT example\.com:80 HTTP\/1\.1\r\n/)
    // `host` is what goes in the Host header, and an ipv6 literal needs the
    // brackets there even though the connection address must not have them
    assert.ok(
      proxy.seen[0].includes(`Host: [${V6}]:${proxy.port}`),
      `Host header was ${JSON.stringify(proxy.seen[0])}`
    )
  } finally {
    await close(proxy.server)
  }
})

test('an http proxy given by ipv4 address still works', async () => {
  const proxy = await startHttpProxy('127.0.0.1')
  try {
    const { socket } = await socks({
      host: 'example.com',
      port: 80,
      proxy: `http://127.0.0.1:${proxy.port}`,
      readyTimeout: 5000
    })
    socket.destroy()
    assert.ok(proxy.seen[0].includes(`Host: 127.0.0.1:${proxy.port}`))
  } finally {
    await close(proxy.server)
  }
})
