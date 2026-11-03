const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('net')
const {
  buildRDCleanPathError,
  rdCleanPathErrorFor,
  performRDPHandshake
} = require('../../app/server/rdp-proxy')
const { checkHost, tcpOpen, pingArgs, pingAnswered } = require('../../app/lib/check-host')

let getRDCleanPathDetails
let rdCleanPathText
let negotiationText
let logonMode
let nextLogonStep
let nlaFallbackOf

before(async () => {
  const mod = await import('../../client/components/rdp/rdp-errors.js')
  getRDCleanPathDetails = mod.getRDCleanPathDetails
  rdCleanPathText = mod.rdCleanPathText
  negotiationText = mod.negotiationText
  logonMode = mod.logonMode
  nextLogonStep = mod.nextLogonStep
  nlaFallbackOf = mod.nlaFallbackOf
})

describe('RDP logon: NLA, else the Windows logon screen', () => {
  test('the switch is on unless turned off', () => {
    assert.equal(nlaFallbackOf({}), true)
    assert.equal(nlaFallbackOf({ nlaFallback: true }), true)
    assert.equal(nlaFallbackOf({ nlaFallback: false }), false)
  })

  test('without the fallback always NLA', () => {
    assert.deepEqual(logonMode({ password: 'pw' }), { credssp: true, password: 'pw' })
    assert.deepEqual(logonMode({ password: '' }), { credssp: true, password: '' })
    for (const kind of [1, 2, 6]) {
      assert.equal(nextLogonStep(kind, { credssp: true }), '')
    }
  })

  test('with the fallback: no password goes to the logon screen, else NLA first', () => {
    assert.deepEqual(logonMode({ nlaFallback: true, password: '' }), { credssp: false, password: '' })
    assert.deepEqual(logonMode({ nlaFallback: true, password: 'pw' }), { credssp: true, password: 'pw' })
  })

  test('the logon screen fallback sends the password only when the bookmark asks for it', () => {
    assert.deepEqual(logonMode({ nlaFallback: true, password: 'pw', logonScreen: true }), { credssp: false, password: '' })
    assert.deepEqual(logonMode({ nlaFallback: true, nlaFallbackPassword: true, password: 'pw', logonScreen: true }), { credssp: false, password: 'pw' })
    assert.deepEqual(logonMode({ nlaFallback: true, nlaFallbackPassword: true, password: 'pw' }), { credssp: true, password: 'pw' })
  })

  test('a failed NLA logon or a server without NLA: the logon screen, once', () => {
    for (const kind of [1, 2, 6]) {
      assert.equal(nextLogonStep(kind, { nlaFallback: true, credssp: true }), 'logonScreen')
    }
    assert.equal(nextLogonStep(1, { nlaFallback: true, credssp: false, logonScreen: true }), '')
    assert.equal(nextLogonStep(3, { nlaFallback: true, credssp: true }), '')
  })

  test('a server requiring NLA when trying without: ask for the password', () => {
    assert.equal(nextLogonStep(6, { nlaFallback: true, credssp: false }), 'askPassword')
    assert.equal(nextLogonStep(6, { nlaFallback: true, credssp: false, logonScreen: true }), 'askPassword')
  })
})

// minimal DER reader: tag, children or integer value
function der (buf, offset = 0) {
  const tag = buf[offset]
  let len = buf[offset + 1]
  let head = 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = buf.readUIntBE(offset + 2, n)
    head += n
  }
  const body = buf.subarray(offset + head, offset + head + len)
  const node = { tag, size: head + len }
  if (tag === 0x02) {
    node.value = body.readIntBE(0, body.length)
  } else if (tag === 0x30 || (tag & 0xe0) === 0xa0) {
    node.children = []
    for (let o = 0; o < body.length;) {
      const c = der(body, o)
      node.children.push(c)
      o += c.size
    }
  }
  return node
}

const freePort = () => new Promise(resolve => {
  const s = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => resolve(port))
  })
})

describe('rdp connect errors', () => {
  test('error pdu carries http, wsa and tls fields', () => {
    const pdu = der(buildRDCleanPathError(1, 504, 10060, 40))
    const [version, error] = pdu.children
    assert.equal(version.tag, 0xa0)
    // RDCleanPath version 1 is 3390
    assert.equal(version.children[0].value, 3390)
    assert.equal(error.tag, 0xa1)
    const fields = error.children[0].children
      .map(f => [f.tag, f.children[0].value])
    assert.deepEqual(fields, [[0xa0, 1], [0xa1, 504], [0xa2, 10060], [0xa3, 40]])
    // optional fields left out
    const plain = der(buildRDCleanPathError(1, 502))
    assert.equal(plain.children[1].children[0].children.length, 2)
  })

  test('node errors map to rdcleanpath fields', () => {
    const e = code => Object.assign(new Error('x'), { code })
    assert.deepEqual(rdCleanPathErrorFor(e('ETIMEDOUT')), { http: 504, wsa: 10060 })
    assert.deepEqual(rdCleanPathErrorFor(e('ECONNREFUSED')), { http: 502, wsa: 10061 })
    assert.deepEqual(rdCleanPathErrorFor(e('ENOTFOUND')), { http: 502, wsa: 11001 })
    assert.deepEqual(rdCleanPathErrorFor(e('X224_TIMEOUT')), { http: 504 })
    assert.deepEqual(
      rdCleanPathErrorFor(Object.assign(new Error('x'), { tls: true })),
      { http: 502, tls: 40 }
    )
    assert.deepEqual(rdCleanPathErrorFor(new Error('x')), { http: 502 })
  })

  test('a refused connect keeps its code through the handshake', async () => {
    const port = await freePort()
    const err = await performRDPHandshake('127.0.0.1', port, Buffer.alloc(0))
      .then(() => null, e => e)
    assert.equal(err.code, 'ECONNREFUSED')
    assert.deepEqual(rdCleanPathErrorFor(err), { http: 502, wsa: 10061 })
  })

  test('client text', () => {
    const t = d => rdCleanPathText(d, '192.168.1.80', 3389)
    assert.match(t({ http: 504, wsa: 10060 }), /^192\.168\.1\.80:3389 does not answer/)
    assert.match(t({ http: 502, wsa: 10061 }), /refused/)
    assert.match(t({ http: 502, wsa: 11001 }), /^192\.168\.1\.80: host name not found/)
    assert.match(t({ http: 502, tls: 40 }), /TLS alert 40/)
    assert.match(t({ http: 504 }), /no remote desktop answer/)
    assert.equal(t({ http: 502 }), '')
    assert.equal(t(null), '')
  })

  test('details from an IronError', () => {
    const ironErr = (kind, d) => ({
      kind: () => kind,
      rdcleanpathDetails: () => d
    })
    assert.deepEqual(
      getRDCleanPathDetails(ironErr(4, { httpStatusCode: 504, wsaErrorCode: 10060 })),
      { http: 504, wsa: 10060, tls: undefined }
    )
    assert.equal(getRDCleanPathDetails(ironErr(1, {})), null)
    assert.equal(getRDCleanPathDetails(new Error('x')), null)
  })

  test('nla mismatch', () => {
    const kind = k => ({ kind: () => k })
    assert.match(negotiationText(kind(6), false), /requires NLA/)
    assert.match(negotiationText(kind(6), true), /Without NLA as fallback/)
    assert.equal(negotiationText(kind(4), true), '')
    assert.equal(negotiationText(new Error('x'), true), '')
  })
})

describe('host check before connecting', () => {
  test('ping arguments and answer', () => {
    assert.deepEqual(pingArgs('h', 'win32'), ['-4', '-n', '1', '-w', '1500', 'h'])
    assert.deepEqual(pingArgs('h', 'linux'), ['-c', '1', '-W', '2', 'h'])
    assert.equal(pingAnswered(0, 'Antwort von 192.168.1.1: Bytes=32 Zeit=1ms TTL=64'), true)
    // windows: a router answering for the host still exits 0
    assert.equal(pingAnswered(0, 'Antwort von 192.168.1.74: Zielhost nicht erreichbar.'), false)
    assert.equal(pingAnswered(1, 'TTL=64'), false)
    assert.equal(pingAnswered(0, '64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.3 ms'), true)
  })

  test('no options smuggled into ping', async () => {
    for (const h of ['-n 9 x', '', 'a b', '-t']) {
      const r = await checkHost(h, 3389)
      assert.equal(r.ok, false)
      assert.equal(r.error, 'invalid host')
    }
  })

  test('service port check, used when ping gets no answer', async () => {
    const server = net.createServer(s => s.destroy())
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    assert.equal(await tcpOpen('127.0.0.1', port), true)
    server.close()
    await new Promise(resolve => server.once('close', resolve))
    assert.equal(await tcpOpen('127.0.0.1', port), false)
  })
})
