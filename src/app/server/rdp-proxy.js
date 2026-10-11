const net = require('net')
const tls = require('tls')
const log = require('../common/log')
const proxySock = require('./socks')

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
// Network: TCP + X.224 + TLS (Node native) + Cert Extraction
// ────────────────────────────────────────────────────
//
// We use Node's built-in tls module. Historically node-forge was used here
// because Node's TLS (BoringSSL in Electron) enforces strict certificate
// checks (e.g. KEY_USAGE_BIT_INCORRECT) that reject typical self-signed RDP
// server certificates — but with `rejectUnauthorized: false` those errors are
// non-fatal, so native TLS is safe and orders of magnitude faster than
// pure-JS forge cryptography (forge was a throughput bottleneck that
// amplified frame backlogs on busy sessions).

/**
 * Create a TCP connection (direct or through proxy)
 * @param {string} host
 * @param {number} port
 * @param {object} options
 * @param {string} options.proxy - Proxy URL
 * @param {number} options.readyTimeout - Connection timeout
 * @param {Buffer} x224Request - X.224 Connection Request to send
 * @param {function} logPrefix - Log prefix function
 * @returns {Promise<net.Socket>}
 */
async function createTcpConnection (host, port, options, x224Request, logPrefix) {
  if (options.proxy) {
    log.debug(`${logPrefix} Connecting through proxy: ${options.proxy}`)
    const proxyResult = await proxySock({
      readyTimeout: options.readyTimeout || 15000,
      host,
      port,
      proxy: options.proxy
    })
    const tcpSocket = proxyResult.socket
    log.debug(`${logPrefix} ✓ Proxy connection established`)

    // Send X.224 Connection Request over proxied connection
    tcpSocket.write(x224Request, () => {
      log.debug(`${logPrefix} ✓ Sent X.224 Connection Request (${x224Request.length} bytes)`)
    })
    return tcpSocket
  }

  return new Promise((resolve, reject) => {
    const tcpSocket = net.createConnection({ host, port }, () => {
      log.debug(`${logPrefix} ✓ TCP connection established`)

      // Send X.224 Connection Request over raw TCP
      tcpSocket.write(x224Request, () => {
        log.debug(`${logPrefix} ✓ Sent X.224 Connection Request (${x224Request.length} bytes)`)
      })
      resolve(tcpSocket)
    })
    tcpSocket.once('error', (err) => {
      reject(new Error(`TCP connection failed: ${err.message}`))
    })
  })
}

/**
 * Read exactly one TPKT-framed PDU (the X.224 Connection Confirm) from the
 * socket, then upgrade the same socket to native TLS. Any bytes received
 * beyond the X.224 confirm (e.g. the TLS ServerHello arriving in the same
 * TCP segment) are pushed back so the TLS layer consumes them.
 *
 * @param {net.Socket} tcpSocket
 * @param {string} host - Used for SNI when it is a hostname (not an IP)
 * @param {function} logPrefix - Log prefix function
 * @returns {Promise<{ x224Response: Buffer, tlsSocket: tls.TLSSocket }>}
 */
function readX224ConfirmAndUpgradeTls (tcpSocket, host, logPrefix) {
  return new Promise((resolve, reject) => {
    let pending = Buffer.alloc(0)
    let expectedLength = -1
    let settled = false

    const settleError = (err) => {
      if (settled) return
      settled = true
      tcpSocket.removeListener('data', onData)
      tcpSocket.removeListener('error', onError)
      reject(err)
    }

    function onError (err) {
      settleError(new Error(`TCP error while waiting for X.224 confirm: ${err.message}`))
    }

    function onData (chunk) {
      pending = Buffer.concat([pending, chunk])
      if (expectedLength < 0) {
        if (pending.length < 4) return
        // TPKT header: version (1 byte, must be 3), reserved (1), length (2, BE)
        if (pending[0] !== 3) {
          settleError(new Error(`Invalid TPKT version ${pending[0]} in X.224 confirm`))
          return
        }
        expectedLength = pending.readUInt16BE(2)
      }
      if (pending.length < expectedLength) return

      const x224Response = pending.subarray(0, expectedLength)
      const rest = pending.subarray(expectedLength)

      // Stop consuming plaintext data before handing the socket to TLS
      tcpSocket.removeListener('data', onData)
      tcpSocket.removeListener('error', onError)
      if (rest.length) {
        tcpSocket.unshift(rest)
      }
      if (settled) return
      settled = true

      log.debug(`${logPrefix} ✓ Received X.224 Connection Confirm (${expectedLength} bytes)`)

      // The handshake-deadline timer set below (in performRDPHandshake) is a
      // `net.Socket` idle-inactivity timer, not a one-shot deadline - it
      // re-arms on every read/write and was never cleared once the handshake
      // finished. Left alone, it destroys this same socket (reused for the
      // whole session relay) after any 15s stretch with no bytes in either
      // direction - e.g. a static remote desktop with no mouse/keyboard
      // activity - killing otherwise-healthy sessions. Disable it now that
      // the handshake is done; a real dead/half-open connection is instead
      // caught by the TCP keepalive enabled below.
      tcpSocket.setTimeout(0)
      tcpSocket.setNoDelay(true)
      tcpSocket.setKeepAlive(true, 10000)

      const servername = net.isIP(host) ? undefined : host
      const tlsSocket = tls.connect({
        socket: tcpSocket,
        servername,
        // RDP servers use self-signed certificates; accept them and let the
        // WASM client validate the chain delivered via RDCleanPath.
        rejectUnauthorized: false
      }, () => {
        log.debug(`${logPrefix} ✓ native TLS handshake completed`)
        resolve({
          x224Response: Buffer.from(x224Response),
          tlsSocket
        })
      })
      tlsSocket.once('error', (err) => {
        settleError(new Error(`TLS handshake failed: ${err.message}`))
      })
    }

    tcpSocket.on('data', onData)
    tcpSocket.on('error', onError)
  })
}

/**
 * Extract the full peer certificate chain (leaf first) as DER buffers.
 * @param {tls.TLSSocket} tlsSocket
 * @returns {Buffer[]}
 */
function getPeerCertChain (tlsSocket) {
  const chain = []
  try {
    let cert = tlsSocket.getPeerCertificate(true)
    while (cert && cert.raw) {
      const der = Buffer.from(cert.raw)
      if (chain.some((existing) => existing.equals(der))) {
        break
      }
      chain.push(der)
      cert = cert.issuerCertificate
    }
  } catch (e) {
    log.error(`${LOG_PREFIX} Error extracting peer certificate chain: ${e.message}`)
  }
  return chain
}

/**
 * Perform the RDP handshake:
 * 1. TCP connect to RDP server (optionally through proxy)
 * 2. Send X.224 Connection Request (raw TCP)
 * 3. Read X.224 Connection Confirm (raw TCP)
 * 4. TLS handshake via Node's native tls module
 * 5. Extract server certificates
 *
 * @param {string} host
 * @param {number} port
 * @param {Buffer} x224Request - X.224 Connection Request bytes
 * @param {object} options - Optional settings
 * @param {string} options.proxy - Proxy URL (e.g., 'socks5://127.0.0.1:1080' or 'http://proxy:8080')
 * @param {number} options.readyTimeout - Connection timeout in ms
 * @returns {Promise<{ x224Response: Buffer, certChain: Buffer[], tlsSocket: tls.TLSSocket, tcpSocket: net.Socket }>}
 */
async function performRDPHandshake (host, port, x224Request, options = {}) {
  const logPrefix = `${LOG_PREFIX} [${host}:${port}]`

  // Step 1: TCP connect (direct or through proxy)
  let tcpSocket
  try {
    tcpSocket = await createTcpConnection(host, port, options, x224Request, logPrefix)
  } catch (err) {
    throw new Error(`Connection failed: ${err.message}`)
  }

  try {
    // Step 2-4: X.224 confirm + native TLS upgrade
    const { x224Response, tlsSocket } = await readX224ConfirmAndUpgradeTls(tcpSocket, host, logPrefix)

    // Step 5: Convert the peer certificate chain to DER
    const certChain = getPeerCertChain(tlsSocket)
    log.debug(`${logPrefix} ✓ Extracted ${certChain.length} certificate(s) from TLS socket`)

    return {
      x224Response,
      certChain,
      tlsSocket,
      tcpSocket
    }
  } catch (err) {
    try { tcpSocket.destroy() } catch (_) {}
    throw err
  }
}

// ────────────────────────────────────────────────────
// Main Handler: Process a WebSocket connection
// ────────────────────────────────────────────────────

// Once more than this many bytes are buffered on the WebSocket (the renderer
// is consuming slower than the RDP server produces), pause the server side
// until it drains. Without this, a busy remote desktop can make the proxy
// buffer unboundedly.
const MAX_WS_BUFFER = 16 * 1024 * 1024

/**
 * Set up bidirectional relay between a WebSocket and a native TLS socket.
 *
 * Browser (WASM) → WebSocket → Proxy → TLS → TCP → RDP Server
 * RDP Server → TCP → TLS → Proxy → WebSocket → Browser (WASM)
 *
 * @param {WebSocket} ws - The WebSocket connection to the browser
 * @param {tls.TLSSocket} tlsSocket - The native TLS connection to the RDP server
 * @param {net.Socket} tcpSocket - The underlying TCP socket
 */
function setupTlsRelay (ws, tlsSocket, tcpSocket) {
  let wsBytesForwarded = 0
  let tlsBytesForwarded = 0
  let drainTimer = null

  const logPrefix = `${LOG_PREFIX} [relay]`

  // RDP Server → TLS → WebSocket (with backpressure)
  tlsSocket.on('data', (buf) => {
    tlsBytesForwarded += buf.length
    try {
      if (ws.readyState !== 1 /* OPEN */) {
        return
      }
      ws.send(buf)
      if (!drainTimer && ws.bufferedAmount > MAX_WS_BUFFER) {
        log.debug(`${logPrefix} WS buffer full (${ws.bufferedAmount} bytes), pausing server side`)
        tlsSocket.pause()
        drainTimer = setInterval(() => {
          if (ws.readyState !== 1 || ws.bufferedAmount < MAX_WS_BUFFER / 2) {
            clearInterval(drainTimer)
            drainTimer = null
            if (ws.readyState === 1) {
              tlsSocket.resume()
            }
          }
        }, 50)
      }
    } catch (err) {
      log.error(`${logPrefix} TLS→WS write error:`, err.message)
    }
  })

  // WebSocket → TLS → RDP Server (browser → remote, e.g. input events)
  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    wsBytesForwarded += buf.length
    try {
      tlsSocket.write(buf)
    } catch (err) {
      log.error(`${logPrefix} WS→TLS write error:`, err.message)
    }
  })

  // Cleanup on close
  const cleanup = (source) => {
    log.debug(`${logPrefix} ${source} closed — WS→TLS: ${wsBytesForwarded} bytes, TLS→WS: ${tlsBytesForwarded} bytes`)
    if (drainTimer) {
      clearInterval(drainTimer)
      drainTimer = null
    }
    if (!tlsSocket.destroyed) tlsSocket.destroy()
    if (!tcpSocket.destroyed) tcpSocket.destroy()
    if (ws.readyState === 1) {
      try { ws.close() } catch (_) {}
    }
  }

  tlsSocket.on('close', () => cleanup('TLS'))
  tlsSocket.on('error', (err) => {
    log.error(`${logPrefix} TLS error:`, err.message)
    cleanup('TLS (error)')
  })

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
 * @param {object} options - Optional settings
 * @param {string} options.proxy - Proxy URL (e.g., 'socks5://127.0.0.1:1080' or 'http://proxy:8080')
 * @param {number} options.readyTimeout - Connection timeout in ms
 */
function handleConnection (ws, options = {}, bufferedMessages = []) {
  log.debug(`${LOG_PREFIX} New WebSocket connection for RDCleanPath proxy`)

  const handleFirstMessage = async (data) => {
    try {
      const requestData = Buffer.isBuffer(data) ? data : Buffer.from(data)
      log.debug(`${LOG_PREFIX} Received RDCleanPath request (${requestData.length} bytes)`)

      // Step 1: Parse RDCleanPath request
      const request = parseRDCleanPathRequest(requestData)
      log.debug(`${LOG_PREFIX} RDCleanPath Request → destination: ${request.destination}, proxyAuth: ${request.proxyAuth}`)

      // Step 2: Parse destination
      const { host, port } = parseDestination(request.destination)
      log.debug(`${LOG_PREFIX} Connecting to RDP server at ${host}:${port}`)

      // Step 3-5: TCP + X.224 + TLS (Node native) + Certs
      const { x224Response, certChain, tlsSocket, tcpSocket } = await performRDPHandshake(
        host,
        port,
        request.x224ConnectionRequest,
        options
      )

      // Step 6: Build and send RDCleanPath response
      const serverAddr = `${host}:${port}`
      const responsePdu = buildRDCleanPathResponse(serverAddr, x224Response, certChain)
      log.debug(`${LOG_PREFIX} ✓ Sending RDCleanPath response (${responsePdu.length} bytes) to browser`)
      ws.send(responsePdu)

      log.debug(`${LOG_PREFIX} ✓ RDCleanPath handshake complete — starting bidirectional relay`)

      // Step 7: Bidirectional relay via native TLS
      setupTlsRelay(ws, tlsSocket, tcpSocket)
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
  }

  // If a message arrived during async setup (before this handler was registered),
  // process it immediately; otherwise wait for the next message event.
  if (bufferedMessages.length > 0) {
    handleFirstMessage(bufferedMessages[0])
  } else {
    ws.once('message', handleFirstMessage)
  }

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
  setupTlsRelay
}
