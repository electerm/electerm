/**
 * Standalone test for the native-TLS rdp-proxy handshake against a real
 * RDP server. No credentials needed — only X.224 + TLS handshake.
 *
 * Usage: node rdp-proxy-handshake-test.js <host> [port]
 */
const Module = require('module')
const { resolve } = require('path')

// stub electron-dependent modules so rdp-proxy runs in plain node
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron-log') {
    const fn = (...a) => console.log(...a)
    return {
      transports: {
        console: {},
        file: {},
        ipc: { level: false }
      },
      debug: fn,
      info: fn,
      warn: fn,
      error: fn
    }
  }
  if (request === 'electron') {
    return { app: { isPackaged: true } }
  }
  if (request === '../package.json' || request === './package.json') {
    // eslint-disable-next-line no-path-concat
    return JSON.parse(require('fs').readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'))
  }
  return origLoad.apply(this, [request, parent, isMain])
}

const { performRDPHandshake, buildRDCleanPathResponse } = require('../../app/server/rdp-proxy')

const host = process.argv[2] || '192.168.5.138'
const port = Number(process.argv[3] || 3389)

// Build an X.224 Connection Request PDU (TPKT + CR + cookie + neg request)
function buildX224ConnectionRequest (requestedProtocols = 0x03) {
  const cookie = Buffer.from('Cookie: mstshash=electerm\r\n', 'utf8')
  const negReq = Buffer.alloc(8)
  negReq[0] = 0x01 // TYPE_RDP_NEG_REQ
  negReq[1] = 0x00 // flags
  negReq.writeUInt16LE(8, 2) // length
  negReq.writeUInt32LE(requestedProtocols, 4)
  const crBody = Buffer.concat([
    Buffer.from([0xe0, 0x00, 0x00, 0x00, 0x00, 0x00]), // CR, dst-ref 0, src-ref 0, class 0
    cookie,
    negReq
  ])
  const li = Buffer.from([crBody.length])
  // TPKT length field = whole packet size including the 4-byte TPKT header
  const totalLen = 4 + 1 + crBody.length
  const tpkt = Buffer.from([0x03, 0x00, (totalLen >> 8) & 0xff, totalLen & 0xff])
  return Buffer.concat([tpkt, li, crBody])
}

async function main () {
  console.log(`testing RDP handshake against ${host}:${port} ...`)
  const x224Request = buildX224ConnectionRequest(0x03) // PROTOCOL_SSL | PROTOCOL_HYBRID
  const { x224Response, certChain, tlsSocket, tcpSocket } = await performRDPHandshake(
    host, port, x224Request, {}
  )

  console.log('X.224 confirm received:', x224Response.length, 'bytes')
  console.log('negotiated protocol bytes:', x224Response.subarray(-8).toString('hex'))
  console.log('TLS authorized:', tlsSocket.authorized, '| cipher:', tlsSocket.getCipher()?.name)
  console.log('cert chain length:', certChain.length)
  certChain.forEach((c, i) => {
    console.log(`  cert[${i}]: ${c.length} bytes DER`)
  })
  if (!certChain.length) {
    throw new Error('no certificate chain extracted')
  }

  // verify the RDCleanPath RESPONSE PDU structure (version + x224 + certs + server addr)
  const responsePdu = buildRDCleanPathResponse(`${host}:${port}`, x224Response, certChain)
  if (responsePdu[0] !== 0x30) {
    throw new Error('RDCleanPath response is not a DER SEQUENCE')
  }
  if (!responsePdu.includes(certChain[0])) {
    throw new Error('RDCleanPath response does not contain the leaf certificate')
  }
  if (!responsePdu.includes(x224Response)) {
    throw new Error('RDCleanPath response does not contain the X.224 confirm')
  }
  console.log('RDCleanPath response PDU OK:', responsePdu.length, 'bytes (contains x224 + certs + server addr)')

  tlsSocket.destroy()
  tcpSocket.destroy()
  console.log('\nHANDSHAKE TEST PASSED')
}

main().catch((err) => {
  console.error('HANDSHAKE TEST FAILED:', err.message)
  process.exit(1)
})
