const net = require('net')
const forge = require('node-forge')
const log = require('../common/log')

// Debug prefix for all RDP proxy messages
const LOG_PREFIX = '[RDP-PROXY]'

// ── RDCleanPath ASN.1 DER Constants ──
const VERSION_1 = 3390 // 3389 + 1

// ASN.1 tag constants
const TAG_SEQUENCE = 0x30
const TAG_INTEGER = 0x02
const TAG_OCTET_STRING = 0x04
const TAG_UTF8STRING = 0x0c

// Context-specific EXPLICIT tags used by RDCleanPath
const TAG_CTX = (n) => 0xa0 + n

// ────────────────────────────────────────────────────
// ASN.1 DER Low-Level Helpers
// ────────────────────────────────────────────────────

/**
 * Encode ASN.1 DER length bytes.
 */
function derEncodeLength (length) {
  if (length < 0x80) {
    return Buffer.from([length])
  }
  const bytes = []
  let temp = length
  while (temp > 0) {
    bytes.unshift(temp & 0xff)
    temp >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

/**
 * Wrap content with a tag and proper DER length encoding.
 */
function derWrap (tag, content) {
  const len = derEncodeLength(content.length)
  return Buffer.concat([Buffer.from([tag]), len, content])
}

/**
 * Encode an integer as ASN.1 DER INTEGER.
 */
function derEncodeInteger (value) {
  if (value === 0) {
    return derWrap(TAG_INTEGER, Buffer.from([0]))
  }
  const bytes = []
  let temp = value
  while (temp > 0) {
    bytes.unshift(temp & 0xff)
    temp >>= 8
  }
  // Add leading zero if high bit set (to keep unsigned)
  if (bytes[0] & 0x80) {
    bytes.unshift(0)
  }
  return derWrap(TAG_INTEGER, Buffer.from(bytes))
}

/**
 * Encode a UTF-8 string as ASN.1 DER UTF8String.
 */
function derEncodeUtf8String (str) {
  return derWrap(TAG_UTF8STRING, Buffer.from(str, 'utf-8'))
}

/**
 * Encode raw bytes as ASN.1 DER OCTET STRING.
 */
function derEncodeOctetString (buf) {
  return derWrap(TAG_OCTET_STRING, buf)
}

/**
 * Wrap content in a context-specific EXPLICIT tag [n].
 */
function derWrapContext (tagNum, content) {
  return derWrap(TAG_CTX(tagNum), content)
}

/**
 * Decode DER length at offset. Returns { length, bytesRead }.
 */
function derDecodeLength (buf, offset) {
  const first = buf[offset]
  if (first < 0x80) {
    return { length: first, bytesRead: 1 }
  }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | buf[offset + 1 + i]
  }
  return { length, bytesRead: 1 + numBytes }
}

/**
 * Decode a DER TLV (Tag-Length-Value) at offset.
 * Returns { tag, value: Buffer, totalLength }.
 */
function derDecodeTLV (buf, offset) {
  const tag = buf[offset]
  const { length, bytesRead } = derDecodeLength(buf, offset + 1)
  const headerLen = 1 + bytesRead
  const value = buf.slice(offset + headerLen, offset + headerLen + length)
  return { tag, value, totalLength: headerLen + length }
}

/**
 * Decode an ASN.1 DER INTEGER to a JS number.
 */
function derDecodeInteger (buf) {
  let val = 0
  for (let i = 0; i < buf.length; i++) {
    val = (val << 8) | buf[i]
  }
  return val
}

/**
 * Decode all TLV elements within a constructed value (SEQUENCE, context tags, etc.).
 * Returns an array of { tag, value, totalLength }.
 */
function derDecodeChildren (buf) {
  const children = []
  let offset = 0
  while (offset < buf.length) {
    const tlv = derDecodeTLV(buf, offset)
    children.push(tlv)
    offset += tlv.totalLength
  }
  return children
}

// ────────────────────────────────────────────────────
// RDCleanPath PDU Parsing & Encoding
// ────────────────────────────────────────────────────

/**
 * Parse an RDCleanPath Request PDU from DER-encoded bytes.
 *
 * Returns: { destination, proxyAuth, x224ConnectionRequest, preconnectionBlob? }
 */
function parseRDCleanPathRequest (data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)

  // Outer SEQUENCE
  const outer = derDecodeTLV(buf, 0)
  if (outer.tag !== TAG_SEQUENCE) {
    throw new Error(`Expected SEQUENCE (0x30), got 0x${outer.tag.toString(16)}`)
  }

  const children = derDecodeChildren(outer.value)

  let version = null
  let destination = null
  let proxyAuth = null
  let x224ConnectionRequest = null
  let preconnectionBlob = null

  for (const child of children) {
    const ctxTag = child.tag & 0x1f // strip class bits to get tag number

    switch (ctxTag) {
      case 0: { // version
        const intTlv = derDecodeTLV(child.value, 0)
        version = derDecodeInteger(intTlv.value)
        break
      }
      case 2: { // destination
        const strTlv = derDecodeTLV(child.value, 0)
        destination = strTlv.value.toString('utf-8')
        break
      }
      case 3: { // proxy_auth
        const strTlv = derDecodeTLV(child.value, 0)
        proxyAuth = strTlv.value.toString('utf-8')
        break
      }
      case 5: { // preconnection_blob
        const strTlv = derDecodeTLV(child.value, 0)
        preconnectionBlob = strTlv.value.toString('utf-8')
        break
      }
      case 6: { // x224_connection_pdu
        const octTlv = derDecodeTLV(child.value, 0)
        x224ConnectionRequest = octTlv.value
        break
      }
    }
  }

  if (version !== VERSION_1) {
    throw new Error(`Unsupported RDCleanPath version: ${version} (expected ${VERSION_1})`)
  }
  if (!destination) {
    throw new Error('Missing destination in RDCleanPath request')
  }
  if (!x224ConnectionRequest) {
    throw new Error('Missing x224_connection_pdu in RDCleanPath request')
  }

  return { destination, proxyAuth, x224ConnectionRequest, preconnectionBlob }
}

/**
 * Build an RDCleanPath Response PDU as DER-encoded bytes.
 *
 * @param {string} serverAddr - Resolved server address (e.g. "192.168.2.31:3389")
 * @param {Buffer} x224Response - X.224 Connection Confirm bytes
 * @param {Buffer[]} certChain - Array of DER-encoded X.509 certificates
 * @returns {Buffer} DER-encoded RDCleanPath response
 */
function buildRDCleanPathResponse (serverAddr, x224Response, certChain) {
  const parts = []

  // [0] version
  parts.push(derWrapContext(0, derEncodeInteger(VERSION_1)))

  // [6] x224_connection_pdu
  parts.push(derWrapContext(6, derEncodeOctetString(x224Response)))

  // [7] server_cert_chain — SEQUENCE OF OCTET STRING
  const certOctets = certChain.map((cert) => derEncodeOctetString(cert))
  const certSeq = derWrap(TAG_SEQUENCE, Buffer.concat(certOctets))
  parts.push(derWrapContext(7, certSeq))

  // [9] server_addr
  parts.push(derWrapContext(9, derEncodeUtf8String(serverAddr)))

  return derWrap(TAG_SEQUENCE, Buffer.concat(parts))
}

/**
 * Build an RDCleanPath Error PDU as DER-encoded bytes.
 *
 * @param {number} errorCode - 1=general, 2=negotiation
 * @param {number} [httpStatusCode] - optional HTTP status code
 * @returns {Buffer} DER-encoded RDCleanPath error response
 */
function buildRDCleanPathError (errorCode, httpStatusCode) {
  const errParts = []

  // [0] error_code
  errParts.push(derWrapContext(0, derEncodeInteger(errorCode)))

  // [1] http_status_code (optional)
  if (httpStatusCode != null) {
    errParts.push(derWrapContext(1, derEncodeInteger(httpStatusCode)))
  }

  const errSeq = derWrap(TAG_SEQUENCE, Buffer.concat(errParts))

  const parts = []
  // [0] version
  parts.push(derWrapContext(0, derEncodeInteger(VERSION_1)))
  // [1] error
  parts.push(derWrapContext(1, errSeq))

  return derWrap(TAG_SEQUENCE, Buffer.concat(parts))
}

// ────────────────────────────────────────────────────
// Network: Destination Parsing
// ────────────────────────────────────────────────────

/**
 * Parse a destination string into { host, port }.
 * Handles IPv6 "[::1]:3389" and regular "host:port" formats.
 * Default port is 3389.
 */
function parseDestination (destination) {
  // IPv6: [host]:port
  if (destination.startsWith('[')) {
    const bracketEnd = destination.indexOf(']')
    if (bracketEnd === -1) throw new Error(`Invalid IPv6 destination: ${destination}`)
    const host = destination.slice(1, bracketEnd)
    const rest = destination.slice(bracketEnd + 1)
    const port = rest.startsWith(':') ? parseInt(rest.slice(1), 10) : 3389
    return { host, port }
  }

  // Regular host:port
  const lastColon = destination.lastIndexOf(':')
  if (lastColon === -1) {
    return { host: destination, port: 3389 }
  }
  const host = destination.slice(0, lastColon)
  const port = parseInt(destination.slice(lastColon + 1), 10)
  if (isNaN(port)) {
    return { host: destination, port: 3389 }
  }
  return { host, port }
}

// ────────────────────────────────────────────────────
// Network: TCP + X.224 + TLS (node-forge) + Cert Extraction
// ────────────────────────────────────────────────────
//
// We use node-forge's pure-JS TLS implementation instead of Node's
// built-in tls module. In Electron, Node's tls uses BoringSSL which
// enforces strict KEY_USAGE_BIT_INCORRECT checks that reject typical
// RDP server certificates. node-forge avoids this entirely.

/**
 * Perform the RDCleanPath proxy handshake:
 * 1. TCP connect to RDP server
 * 2. Send X.224 Connection Request (raw TCP)
 * 3. Read X.224 Connection Confirm (raw TCP)
 * 4. TLS handshake via node-forge (bypasses BoringSSL)
 * 5. Extract server certificates
 *
 * @param {string} host
 * @param {number} port
 * @param {Buffer} x224Request - X.224 Connection Request bytes
 * @returns {Promise<{ x224Response: Buffer, certChain: Buffer[], forgeTls: object, tcpSocket: net.Socket }>}
 */
function performRDPHandshake (host, port, x224Request) {
  return new Promise((resolve, reject) => {
    const logPrefix = `${LOG_PREFIX} [${host}:${port}]`
    let settled = false

    function settle (err, result) {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve(result)
    }

    // Step 1: TCP connect
    const tcpSocket = net.createConnection({ host, port }, () => {
      log.debug(`${logPrefix} ✓ TCP connection established`)

      // Step 2: Send X.224 Connection Request over raw TCP
      tcpSocket.write(x224Request, () => {
        log.debug(`${logPrefix} ✓ Sent X.224 Connection Request (${x224Request.length} bytes)`)
      })
    })

    tcpSocket.once('error', (err) => {
      settle(new Error(`TCP connection failed: ${err.message}`))
    })

    // Step 3: Read X.224 Connection Confirm
    tcpSocket.once('data', (x224Response) => {
      log.debug(`${logPrefix} ✓ Received X.224 Connection Confirm (${x224Response.length} bytes)`)

      if (x224Response.length === 0) {
        tcpSocket.destroy()
        settle(new Error('RDP server closed connection without X.224 response'))
        return
      }

      // Remove all listeners before upgrading to TLS
      tcpSocket.removeAllListeners('error')
      tcpSocket.removeAllListeners('data')

      // Step 4: TLS handshake via node-forge (pure JS — no BoringSSL)
      log.debug(`${logPrefix} Starting TLS handshake via node-forge`)

      // Capture the cert chain from the verify callback
      let capturedCertChain = []

      const forgeTls = forge.tls.createConnection({
        server: false,
        verify: function (connection, verified, depth, certs) {
          // Accept all certificates (RDP servers use self-signed certs)
          log.debug(`${logPrefix} TLS verify callback: depth=${depth}, verified=${verified}, certs=${certs.length}`)
          // Capture the full chain on the first call (depth = deepest)
          if (certs && certs.length > capturedCertChain.length) {
            capturedCertChain = certs
          }
          return true
        },
        connected: function (connection) {
          log.debug(`${logPrefix} ✓ node-forge TLS handshake completed`)

          // Step 5: Convert captured certificates to DER
          const certChain = forgeCertsToDer(capturedCertChain)
          log.debug(`${logPrefix} ✓ Extracted ${certChain.length} certificate(s) from forge`)

          settle(null, {
            x224Response: Buffer.from(x224Response),
            certChain,
            forgeTls,
            tcpSocket
          })
        },
        tlsDataReady: function (connection) {
          // Encrypted data ready to send to the RDP server over TCP
          const data = connection.tlsData.getBytes()
          const buf = Buffer.from(data, 'binary')
          try {
            tcpSocket.write(buf)
          } catch (err) {
            log.error(`${logPrefix} Error writing TLS data to TCP: ${err.message}`)
          }
        },
        dataReady: function (connection) {
          // Decrypted data from RDP server — handled by setupForgeRelay
        },
        closed: function () {
          log.debug(`${logPrefix} node-forge TLS connection closed`)
        },
        error: function (connection, error) {
          log.error(`${logPrefix} node-forge TLS error: ${error.message}`)
          settle(new Error(`TLS handshake failed: ${error.message}`))
        }
      })

      // Feed received TCP data into forge TLS engine
      tcpSocket.on('data', (data) => {
        try {
          forgeTls.process(data.toString('binary'))
        } catch (err) {
          log.error(`${logPrefix} forge process error: ${err.message}`)
        }
      })

      tcpSocket.on('error', (err) => {
        log.error(`${logPrefix} TCP error during TLS: ${err.message}`)
        settle(new Error(`TCP error: ${err.message}`))
      })

      // Initiate the TLS handshake
      forgeTls.handshake()
    })

    // Timeout for the whole handshake
    tcpSocket.setTimeout(15000, () => {
      tcpSocket.destroy()
      settle(new Error('Connection timed out'))
    })
  })
}

/**
 * Convert an array of node-forge certificate objects to DER-encoded Buffers.
 */
function forgeCertsToDer (certs) {
  const result = []
  for (const cert of certs) {
    try {
      const asn1 = forge.pki.certificateToAsn1(cert)
      const derBytes = forge.asn1.toDer(asn1).getBytes()
      result.push(Buffer.from(derBytes, 'binary'))
    } catch (e) {
      log.error(`${LOG_PREFIX} Error converting cert to DER: ${e.message}`)
    }
  }
  return result
}

// ────────────────────────────────────────────────────
// Bidirectional Relay: WebSocket ↔ forge TLS ↔ TCP
// ────────────────────────────────────────────────────

/**
 * Set up bidirectional relay between a WebSocket and a forge TLS connection.
 *
 * Browser (WASM) → WebSocket → Proxy → forge TLS → TCP → RDP Server
 * RDP Server → TCP → forge TLS → Proxy → WebSocket → Browser (WASM)
 *
 * @param {WebSocket} ws - The WebSocket connection to the browser
 * @param {object} forgeTls - The node-forge TLS connection
 * @param {net.Socket} tcpSocket - The underlying TCP socket
 */
function setupForgeRelay (ws, forgeTls, tcpSocket) {
  let wsBytesForwarded = 0
  let tlsBytesForwarded = 0

  const logPrefix = `${LOG_PREFIX} [relay]`

  // Override forge's dataReady to forward decrypted data to WebSocket
  forgeTls.dataReady = function (connection) {
    const data = connection.data.getBytes()
    const buf = Buffer.from(data, 'binary')
    tlsBytesForwarded += buf.length
    try {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(buf)
      }
    } catch (err) {
      log.error(`${logPrefix} TLS→WS write error:`, err.message)
    }
  }

  // Override forge's closed/error for relay phase
  forgeTls.closed = function () {
    log.debug(`${logPrefix} forge TLS closed`)
    cleanup('forge TLS')
  }
  forgeTls.error = function (connection, error) {
    log.error(`${logPrefix} forge TLS error during relay: ${error.message}`)
    cleanup('forge TLS (error)')
  }

  // WebSocket → forge TLS → TCP (browser → RDP server)
  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    wsBytesForwarded += buf.length
    try {
      forgeTls.prepare(buf.toString('binary'))
    } catch (err) {
      log.error(`${logPrefix} WS→TLS write error:`, err.message)
    }
  })

  // Cleanup on close
  const cleanup = (source) => {
    log.debug(`${logPrefix} ${source} closed — WS→TLS: ${wsBytesForwarded} bytes, TLS→WS: ${tlsBytesForwarded} bytes`)
    if (!tcpSocket.destroyed) tcpSocket.destroy()
    try { forgeTls.close() } catch (_) {}
    if (ws.readyState === 1) {
      try { ws.close() } catch (_) {}
    }
  }

  tcpSocket.on('end', () => cleanup('TCP'))
  tcpSocket.on('error', (err) => {
    log.error(`${logPrefix} TCP error:`, err.message)
    cleanup('TCP (error)')
  })

  ws.on('close', () => cleanup('WebSocket'))
  ws.on('error', (err) => {
    log.error(`${logPrefix} WebSocket error:`, err.message)
    cleanup('WebSocket (error)')
  })
}

// ────────────────────────────────────────────────────
// Main Handler: Process a WebSocket connection
// ────────────────────────────────────────────────────

/**
 * Handle a new WebSocket connection from the browser's WASM RDP client.
 *
 * Protocol:
 * 1. Receive RDCleanPath Request (ASN.1 DER binary message)
 * 2. Parse destination, X.224 connection request
 * 3. TCP connect to RDP server, send X.224, receive X.224 confirm
 * 4. TLS handshake, extract server certificates
 * 5. Send RDCleanPath Response back to browser
 * 6. Bidirectional relay: WebSocket ↔ TLS
 *
 * @param {WebSocket} ws - The WebSocket connection
 */
function handleConnection (ws) {
  log.debug(`${LOG_PREFIX} New WebSocket connection for RDCleanPath proxy`)

  // Wait for the first binary message: RDCleanPath Request
  ws.once('message', async (data) => {
    try {
      const requestData = Buffer.isBuffer(data) ? data : Buffer.from(data)
      log.debug(`${LOG_PREFIX} Received RDCleanPath request (${requestData.length} bytes)`)

      // Step 1: Parse RDCleanPath request
      const request = parseRDCleanPathRequest(requestData)
      log.debug(`${LOG_PREFIX} RDCleanPath Request → destination: ${request.destination}, proxyAuth: ${request.proxyAuth}`)

      // Step 2: Parse destination
      const { host, port } = parseDestination(request.destination)
      log.debug(`${LOG_PREFIX} Connecting to RDP server at ${host}:${port}`)

      // Step 3-5: TCP + X.224 + TLS (node-forge) + Certs
      const { x224Response, certChain, forgeTls, tcpSocket } = await performRDPHandshake(
        host,
        port,
        request.x224ConnectionRequest
      )

      // Step 6: Build and send RDCleanPath response
      const serverAddr = `${host}:${port}`
      const responsePdu = buildRDCleanPathResponse(serverAddr, x224Response, certChain)
      log.debug(`${LOG_PREFIX} ✓ Sending RDCleanPath response (${responsePdu.length} bytes) to browser`)
      ws.send(responsePdu)

      log.debug(`${LOG_PREFIX} ✓ RDCleanPath handshake complete — starting bidirectional relay`)

      // Step 7: Bidirectional relay via node-forge
      setupForgeRelay(ws, forgeTls, tcpSocket)
    } catch (err) {
      log.error(`${LOG_PREFIX} RDCleanPath handshake error:`, err.message)
      log.error(`${LOG_PREFIX} Stack:`, err.stack)

      // Try to send error response to client
      try {
        const errorPdu = buildRDCleanPathError(1, 502)
        ws.send(errorPdu)
      } catch (_) {}

      try { ws.close() } catch (_) {}
    }
  })

  ws.on('error', (err) => {
    log.error(`${LOG_PREFIX} WebSocket error:`, err.message)
  })
}

module.exports = {
  handleConnection,
  parseRDCleanPathRequest,
  buildRDCleanPathResponse,
  buildRDCleanPathError,
  parseDestination,
  performRDPHandshake,
  setupForgeRelay
}
