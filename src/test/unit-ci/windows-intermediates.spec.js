process.env.NODE_ENV = 'development'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const https = require('node:https')
const tls = require('node:tls')
const os = require('node:os')
const forge = require('node-forge')
const systemCA = require('../../app/lib/system-ca')
const sync = require('../../app/server/sync')

function certificate (name, serial, issuer, server = false) {
  const { pki } = forge
  const keys = pki.rsa.generateKeyPair(2048)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = serial
  cert.validity.notBefore = new Date(Date.now() - 60000)
  cert.validity.notAfter = new Date(Date.now() + 3600000)
  cert.setSubject([{ name: 'commonName', value: name }])
  cert.setIssuer(issuer ? issuer.cert.subject.attributes : cert.subject.attributes)
  cert.setExtensions(server
    ? [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }]
    : [{ name: 'basicConstraints', cA: true }, { name: 'keyUsage', keyCertSign: true }])
  cert.sign(issuer ? issuer.keys.privateKey : keys.privateKey, forge.md.sha256.create())
  return { keys, cert, pem: pki.certificateToPem(cert) }
}

test('concurrent WebDAV requests complete a leaf-only TLS chain with the Windows intermediate', {
  skip: !tls.setDefaultCACertificates
}, async t => {
  const root = certificate('Test root', '01')
  const intermediate = certificate('Test intermediate', '02', root)
  const leaf = certificate('Test server', '03', intermediate, true)
  const defaults = tls.getCACertificates('default')
  t.after(() => tls.setDefaultCACertificates(defaults))
  tls.setDefaultCACertificates([...defaults, root.pem])
  const received = []
  const server = https.createServer({
    key: forge.pki.privateKeyToPem(leaf.keys.privateKey),
    cert: leaf.pem
  }, (req, res) => {
    received.push(req.method)
    res.writeHead(207).end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const url = `https://127.0.0.1:${server.address().port}`
  await assert.rejects(once(https.get(url), 'response'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })

  t.mock.method(os, 'platform', () => 'win32')
  const read = t.mock.method(systemCA, 'readWindowsIntermediates', async () =>
    new Set([intermediate.pem.replace(/-----[^\n]+-----|\s/g, '')]))
  const probe = () => sync({ s: ({ data }) => assert.deepEqual(data, { success: true, status: 207 }) },
    { type: 'webdav', func: 'test', args: [], token: url })
  await Promise.all([probe(), probe()])
  assert.equal(read.mock.callCount(), 1)
  assert.deepEqual(received, ['PROPFIND', 'PROPFIND'])
})
