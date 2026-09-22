process.env.NODE_ENV = 'development'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const tls = require('node:tls')
const forge = require('node-forge')

const {
  createTcpConnection,
  subjectMatches
} = require('../../../src/app/server/spice-proxy')
const { session: createSpiceSession } = require('../../../src/app/server/session-spice')

// A .vv with only tls-port makes electerm speak TLS to the SPICE server, and
// the Proxmox variant puts a signed ticket in `host` with the real certificate
// subject in `host-subject` (PVE::AccessControl::remote_viewer_config). Both
// go through the same code path, so the peer here is a real TLS server with a
// real certificate chain.

const HOST_SUBJECT = 'OU=Electerm Test,O=electerm,CN=127.0.0.1'

function makeCert ({ subject, issuer, publicKey, signingKey, isCa, altNames }) {
  const cert = forge.pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = String(Math.floor(Math.random() * 1e9))
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000)
  cert.validity.notAfter = new Date(Date.now() + 24 * 3600 * 1000)
  cert.setSubject(subject)
  cert.setIssuer(issuer)
  const extensions = [
    { name: 'basicConstraints', cA: !!isCa },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: !!isCa }
  ]
  if (altNames) {
    extensions.push({ name: 'subjectAltName', altNames })
    extensions.push({ name: 'extKeyUsage', serverAuth: true })
  }
  cert.setExtensions(extensions)
  cert.sign(signingKey, forge.md.sha256.create())
  return cert
}

function makeCa () {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const subject = [{ name: 'commonName', value: 'electerm test ca' }]
  const cert = makeCert({
    subject,
    issuer: subject,
    publicKey: keys.publicKey,
    signingKey: keys.privateKey,
    isCa: true
  })
  return { keys, subject, pem: forge.pki.certificateToPem(cert) }
}

/**
 * A CA plus a server certificate for 127.0.0.1 signed by it.
 * @returns {{ caPem: string, keyPem: string, certPem: string }}
 */
function makeChain () {
  const ca = makeCa()
  const serverKeys = forge.pki.rsa.generateKeyPair(2048)
  const serverCert = makeCert({
    subject: [
      { name: 'organizationalUnitName', value: 'Electerm Test' },
      { name: 'organizationName', value: 'electerm' },
      { name: 'commonName', value: '127.0.0.1' }
    ],
    issuer: ca.subject,
    publicKey: serverKeys.publicKey,
    signingKey: ca.keys.privateKey,
    altNames: [
      { type: 7, ip: '127.0.0.1' },
      { type: 2, value: 'localhost' }
    ]
  })
  return {
    caPem: ca.pem,
    keyPem: forge.pki.privateKeyToPem(serverKeys.privateKey),
    certPem: forge.pki.certificateToPem(serverCert)
  }
}

function startTlsEchoServer (chain) {
  return new Promise(resolve => {
    const server = tls.createServer(
      { key: chain.keyPem, cert: chain.certPem },
      socket => {
        socket.on('data', d => socket.write(d))
        socket.on('error', () => {})
      }
    )
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

function startPlainEchoServer () {
  return new Promise(resolve => {
    const server = net.createServer(socket => {
      socket.on('data', d => socket.write(d))
      socket.on('error', () => {})
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

function echo (socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('echo timed out')), 5000)
    socket.once('data', d => {
      clearTimeout(timer)
      resolve(d.toString())
    })
    socket.once('error', reject)
    socket.write('ping')
  })
}

/** Minimal stand-in for a ws server-side socket. */
class FakeWs {
  constructor () {
    this.readyState = 1
    this.CLOSED = 3
    this.sent = []
    this.handlers = {}
  }

  on (name, fn) {
    this.handlers[name] = this.handlers[name] || []
    this.handlers[name].push(fn)
  }

  emit (name, ...args) {
    for (const fn of this.handlers[name] || []) {
      fn(...args)
    }
  }

  send (data) {
    this.sent.push(data)
  }

  close () {
    if (this.readyState === this.CLOSED) {
      return
    }
    this.readyState = this.CLOSED
    this.emit('close')
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor (fn, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (fn()) {
      return
    }
    await sleep(20)
  }
  throw new Error('waitFor timed out')
}

describe('spice-proxy TLS transport', () => {
  let chain
  let other
  let tlsServer
  let tlsPort
  let plainServer
  let plainPort

  before(async () => {
    chain = makeChain()
    other = makeCa()
    const a = await startTlsEchoServer(chain)
    tlsServer = a.server
    tlsPort = a.port
    const b = await startPlainEchoServer()
    plainServer = b.server
    plainPort = b.port
  })

  after(() => {
    tlsServer.close()
    plainServer.close()
  })

  it('talks TLS when tls is set, trusting the file CA', async () => {
    const socket = await createTcpConnection('127.0.0.1', tlsPort, {
      tls: true,
      ca: chain.caPem,
      hostSubject: HOST_SUBJECT
    })
    assert.strictEqual(socket.encrypted, true)
    assert.strictEqual(await echo(socket), 'ping')
    socket.destroy()
  })

  it('rejects a certificate the file CA did not sign', async () => {
    await assert.rejects(
      createTcpConnection('127.0.0.1', tlsPort, {
        tls: true,
        ca: other.pem,
        hostSubject: HOST_SUBJECT
      }),
      /TLS connection failed/
    )
  })

  it('rejects a certificate whose subject is not the host-subject', async () => {
    await assert.rejects(
      createTcpConnection('127.0.0.1', tlsPort, {
        tls: true,
        ca: chain.caPem,
        hostSubject: 'OU=Someone Else,O=elsewhere,CN=other'
      }),
      /does not match host-subject/
    )
  })

  it('still connects without a ca, but only checks host-subject', async () => {
    const socket = await createTcpConnection('127.0.0.1', tlsPort, {
      tls: true,
      hostSubject: HOST_SUBJECT
    })
    assert.strictEqual(await echo(socket), 'ping')
    socket.destroy()
  })

  it('verifies the hostname when no host-subject is given', async () => {
    const socket = await createTcpConnection('127.0.0.1', tlsPort, {
      tls: true,
      ca: chain.caPem
    })
    assert.strictEqual(socket.authorized, true)
    socket.destroy()
  })

  it('leaves a plain connection plain', async () => {
    const socket = await createTcpConnection('127.0.0.1', plainPort, {})
    assert.strictEqual(socket.encrypted, undefined)
    assert.strictEqual(await echo(socket), 'ping')
    socket.destroy()
  })

  it('matches a host-subject against the peer certificate', () => {
    const cert = { subject: { CN: '127.0.0.1', O: 'electerm', OU: 'Electerm Test' } }
    // field order is not significant
    assert.strictEqual(subjectMatches(HOST_SUBJECT, cert), true)
    assert.strictEqual(
      subjectMatches('CN=127.0.0.1,OU=Electerm Test,O=electerm', cert),
      true
    )
    // A wrong value, a missing field and an extra field all fail.
    // spice-gtk compares the entry counts before the entries themselves
    // (ssl_verify.c: verify_subject), so a subset must not match.
    assert.strictEqual(subjectMatches('OU=Electerm Test,O=nope,CN=127.0.0.1', cert), false)
    assert.strictEqual(subjectMatches('CN=127.0.0.1', cert), false)
    assert.strictEqual(subjectMatches(HOST_SUBJECT + ',L=Somewhere', cert), false)
    assert.strictEqual(subjectMatches('', cert), false)
    assert.strictEqual(subjectMatches(HOST_SUBJECT, {}), false)
  })

  it('parses escaped commas and backslashes in a host-subject', () => {
    const cert = { subject: { CN: 'a,b', O: 'c\\d' } }
    assert.strictEqual(subjectMatches('CN=a\\,b,O=c\\\\d', cert), true)
    assert.strictEqual(subjectMatches('CN=a,O=c\\\\d', cert), false)
    // not a well formed list: no assignment, and an empty value
    assert.strictEqual(subjectMatches('garbage', cert), false)
    assert.strictEqual(subjectMatches('CN=,O=c\\\\d', cert), false)
  })

  it('counts a repeated subject field once per entry', () => {
    const cert = { subject: { CN: ['a', 'b'], O: 'o' } }
    assert.strictEqual(subjectMatches('CN=a,CN=b,O=o', cert), true)
    assert.strictEqual(subjectMatches('CN=a,O=o', cert), false)
  })

  // The full main-process path: bookmark fields -> TerminalSpice.start ->
  // handleConnection -> TLS -> the websocket the renderer talks to.
  it('relays a spice session over TLS when the bookmark asks for it', async () => {
    const term = await createSpiceSession({
      uid: 'spice-tls-relay-test',
      termType: 'spice',
      type: 'spice',
      host: '127.0.0.1',
      port: tlsPort,
      tls: true,
      ca: chain.caPem,
      hostSubject: HOST_SUBJECT
    })
    const ws = new FakeWs()
    try {
      await term.start({}, ws)
      await sleep(1000)
      assert.strictEqual(term.wsMap.size, 1, 'channel should be open')
      ws.emit('message', Buffer.from('ping'))
      await waitFor(() => ws.sent.length > 0)
      assert.strictEqual(ws.sent[0].toString(), 'ping')
    } finally {
      term.kill()
    }
  })
})
