const net = require('net')
const tls = require('tls')
const forge = require('node-forge')
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
// Network: TCP + X.224 + TLS + Cert Extraction
// ────────────────────────────────────────────────────
//
// TLS is terminated here with Node's built-in `tls` module. Pure-JS node-forge
// used to be the only option, but its cryptography was the throughput
// bottleneck: on a busy remote desktop (an AI agent scrolling a terminal, say)
// the proxy could not keep up with the server and every frame queued up behind
// the last one.
//
// Native TLS cannot talk to every RDP server though. In Electron, Node's TLS
// runs on BoringSSL, which refuses to finish a handshake when the server
// certificate's KeyUsage extension lacks the digitalSignature bit:
//
//   ERR_SSL_KEY_USAGE_BIT_INCORRECT ... ssl/ssl_cert.cc:397
//
// That check is part of the handshake state machine, not of certificate
// verification, so `rejectUnauthorized: false` does not bypass it, and
// `maxVersion: 'TLSv1.2'` on its own does not either - ECDHE_RSA also signs
// with the server key. Static RSA key exchange is the one path where the
// certificate is only used for encryption, hence the second attempt. Servers
// that fail both fall back to node-forge, which has no certificate policy at
// all (and is only as slow as it always was, i.e. still working).
//
// The strategy that worked is remembered per host, so the extra attempts cost
// one reconnect on the first connect to a given server only.

const HANDSHAKE_TIMEOUT = 15000

// Stop reading from the server when this much data is queued for the renderer,
// resume once it drains below the low-water mark. Without this a busy remote
// desktop makes the proxy buffer without bound, and the renderer (which is
// decoding those frames one by one) falls further and further behind.
const MAX_WS_BUFFER = 16 * 1024 * 1024
const WS_BUFFER_LOW = 4 * 1024 * 1024
const DRAIN_POLL_INTERVAL = 50

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
      readyTimeout: options.readyTimeout || HANDSHAKE_TIMEOUT,
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
 * socket. Any bytes received past it are handed back so they can be pushed
 * into the TLS layer instead of being dropped.
 *
 * Uses a one-shot timer rather than `socket.setTimeout()`, which would leave
 * an idle-inactivity timer armed on the socket that ends up carrying the whole
 * session.
 *
 * @param {net.Socket} tcpSocket
 * @param {string} logPrefix
 * @returns {Promise<{ x224Response: Buffer, rest: Buffer }>}
 */
function readX224Confirm (tcpSocket, logPrefix) {
  return new Promise((resolve, reject) => {
    let pending = Buffer.alloc(0)
    let expectedLength = -1
    let settled = false

    const cleanup = () => {
      clearTimeout(timer)
      tcpSocket.removeListener('data', onData)
      tcpSocket.removeListener('error', onError)
      tcpSocket.removeListener('end', onEnd)
      tcpSocket.removeListener('close', onClose)
    }

    const settle = (err, result) => {
      if (settled) return
      settled = true
      cleanup()
      if (err) reject(err)
      else resolve(result)
    }

    function onError (err) {
      settle(new Error(`TCP error while waiting for X.224 confirm: ${err.message}`))
    }

    function onEnd () {
      settle(new Error('RDP server closed connection without X.224 response'))
    }

    function onClose () {
      settle(new Error('RDP connection closed before X.224 confirm'))
    }

    function onData (chunk) {
      pending = Buffer.concat([pending, chunk])

      if (expectedLength < 0) {
        if (pending.length < 4) return
        // TPKT header: version (1 byte, must be 3), reserved (1), length (2, BE)
        if (pending[0] !== 3) {
          settle(new Error(`Invalid TPKT version ${pending[0]} in X.224 confirm`))
          return
        }
        expectedLength = pending.readUInt16BE(2)
      }

      if (pending.length < expectedLength) return

      // Stop the stream from emitting further chunks synchronously: anything
      // still buffered belongs to the TLS layer.
      tcpSocket.pause()

      log.debug(`${logPrefix} ✓ Received X.224 Connection Confirm (${expectedLength} bytes)`)

      settle(null, {
        x224Response: pending.subarray(0, expectedLength),
        rest: pending.subarray(expectedLength)
      })
    }

    const timer = setTimeout(() => {
      settle(new Error('Connection timed out'))
    }, HANDSHAKE_TIMEOUT)

    tcpSocket.on('data', onData)
    tcpSocket.on('error', onError)
    tcpSocket.on('end', onEnd)
    tcpSocket.on('close', onClose)
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
      // A self-signed certificate is its own issuer: stop instead of looping.
      if (chain.some((existing) => existing.equals(der))) break
      chain.push(der)
      cert = cert.issuerCertificate
    }
  } catch (e) {
    log.error(`${LOG_PREFIX} Error extracting peer certificate chain: ${e.message}`)
  }
  return chain
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

/**
 * @typedef {object} TlsTransport
 * @property {string} kind - 'native' or 'forge', for logging
 * @property {net.Socket} tcpSocket
 * @property {(buf: Buffer) => void} send - encrypt and write towards the server
 * @property {(cb: (buf: Buffer) => void) => void} onData - decrypted server data
 * @property {(cb: () => void) => void} onClose
 * @property {(cb: (err: Error) => void) => void} onError
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {() => void} destroy
 */

/**
 * Upgrade a socket that just carried the X.224 handshake to native TLS.
 *
 * @param {net.Socket} tcpSocket
 * @param {string} host
 * @param {Buffer} rest - bytes read past the X.224 confirm
 * @param {object} tlsOptions - extra options for `tls.connect`
 * @param {string} logPrefix
 * @returns {Promise<{ certChain: Buffer[], transport: TlsTransport }>}
 */
function nativeTlsUpgrade (tcpSocket, host, rest, tlsOptions, logPrefix) {
  return new Promise((resolve, reject) => {
    // Hand the socket over paused: the TLS layer reads from its internal
    // buffer, and leftover plaintext bytes must not be emitted as `data`.
    tcpSocket.pause()
    if (rest.length) tcpSocket.unshift(rest)

    let settled = false
    const settle = (err, result) => {
      if (settled) return
      settled = true
      tcpSocket.removeListener('close', onClose)
      if (err) reject(err)
      else resolve(result)
    }

    function onClose () {
      settle(new Error('RDP connection closed during TLS handshake'))
    }

    const servername = net.isIP(host) ? undefined : host
    const tlsSocket = tls.connect({
      socket: tcpSocket,
      servername,
      // RDP servers use self-signed certificates, and the client shows the
      // certificate details instead of trusting them.
      rejectUnauthorized: false,
      ...tlsOptions
    }, () => {
      log.debug(`${logPrefix} ✓ native TLS handshake completed (${tlsSocket.getProtocol()}, ${tlsSocket.getCipher()?.name})`)
      tcpSocket.setNoDelay(true)
      tcpSocket.setKeepAlive(true, 10000)
      settle(null, {
        certChain: getPeerCertChain(tlsSocket),
        transport: createNativeTransport(tlsSocket, tcpSocket)
      })
    })

    tcpSocket.once('close', onClose)
    tlsSocket.once('error', (err) => {
      settle(new Error(`${err.code || 'TLS error'}: ${err.message}`))
    })
  })
}

/**
 * Upgrade a socket that just carried the X.224 handshake to node-forge TLS.
 *
 * @param {net.Socket} tcpSocket
 * @param {Buffer} rest - bytes read past the X.224 confirm
 * @param {string} logPrefix
 * @returns {Promise<{ certChain: Buffer[], transport: TlsTransport }>}
 */
function forgeTlsUpgrade (tcpSocket, rest, logPrefix) {
  return new Promise((resolve, reject) => {
    log.debug(`${logPrefix} Starting TLS handshake via node-forge`)

    let capturedCertChain = []
    let settled = false

    const settle = (err, result) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve(result)
    }

    const forgeTls = forge.tls.createConnection({
      server: false,
      verify: function (connection, verified, depth, certs) {
        // Accept all certificates (RDP servers use self-signed certs)
        log.debug(`${logPrefix} TLS verify callback: depth=${depth}, verified=${verified}, certs=${certs.length}`)
        if (certs && certs.length > capturedCertChain.length) {
          capturedCertChain = certs
        }
        return true
      },
      connected: function (connection) {
        log.debug(`${logPrefix} ✓ node-forge TLS handshake completed`)
        tcpSocket.setNoDelay(true)
        tcpSocket.setKeepAlive(true, 10000)
        settle(null, {
          certChain: forgeCertsToDer(capturedCertChain),
          transport: createForgeTransport(forgeTls, tcpSocket)
        })
      },
      tlsDataReady: function (connection) {
        // Encrypted data ready to send to the RDP server over TCP
        const buf = Buffer.from(connection.tlsData.getBytes(), 'binary')
        try {
          tcpSocket.write(buf)
        } catch (err) {
          log.error(`${logPrefix} Error writing TLS data to TCP: ${err.message}`)
        }
      },
      dataReady: function () {
        // Replaced by the relay once the handshake is done
      },
      closed: function () {
        log.debug(`${logPrefix} node-forge TLS connection closed`)
      },
      error: function (connection, error) {
        settle(new Error(`TLS handshake failed: ${error.message}`))
      }
    })

    // Feed received TCP data into the forge TLS engine. The relay takes over
    // this same listener (see createForgeTransport), it is not attached twice.
    tcpSocket.on('data', (data) => {
      try {
        forgeTls.process(data.toString('binary'))
      } catch (err) {
        log.error(`${logPrefix} forge process error: ${err.message}`)
      }
    })

    // Bytes read past the X.224 confirm go in first, then the socket (which the
    // X.224 reader left paused) resumes feeding the engine.
    if (rest.length) {
      try {
        forgeTls.process(rest.toString('binary'))
      } catch (err) {
        log.error(`${logPrefix} forge process error: ${err.message}`)
      }
    }
    tcpSocket.resume()

    tcpSocket.once('close', () => {
      settle(new Error('RDP connection closed during TLS handshake'))
    })

    forgeTls.handshake()
  })
}

/**
 * Native TLS transport: the `tls` socket is the encryption layer, the raw
 * socket underneath carries backpressure.
 */
function createNativeTransport (tlsSocket, tcpSocket) {
  return {
    kind: 'native',
    tcpSocket,
    send (buf) {
      tlsSocket.write(buf)
    },
    onData (cb) {
      tlsSocket.on('data', cb)
    },
    onClose (cb) {
      tlsSocket.on('close', cb)
    },
    onError (cb) {
      tlsSocket.on('error', cb)
    },
    pause () {
      tlsSocket.pause()
    },
    resume () {
      tlsSocket.resume()
    },
    destroy () {
      if (!tlsSocket.destroyed) tlsSocket.destroy()
      if (!tcpSocket.destroyed) tcpSocket.destroy()
    }
  }
}

/**
 * node-forge transport. The `data` listener on the raw socket is already in
 * place from the handshake, so this only swaps the forge callbacks over to the
 * relay.
 */
function createForgeTransport (forgeTls, tcpSocket) {
  let dataCb = () => {}
  let closeCb = () => {}
  let errorCb = () => {}

  forgeTls.dataReady = function (connection) {
    dataCb(Buffer.from(connection.data.getBytes(), 'binary'))
  }
  forgeTls.closed = function () {
    closeCb()
  }
  forgeTls.error = function (connection, error) {
    errorCb(new Error(error.message))
  }

  return {
    kind: 'forge',
    tcpSocket,
    send (buf) {
      forgeTls.prepare(buf.toString('binary'))
    },
    onData (cb) {
      dataCb = cb
    },
    onClose (cb) {
      closeCb = cb
    },
    onError (cb) {
      errorCb = cb
    },
    pause () {
      tcpSocket.pause()
    },
    resume () {
      tcpSocket.resume()
    },
    destroy () {
      try { forgeTls.close() } catch (_) {}
      if (!tcpSocket.destroyed) tcpSocket.destroy()
    }
  }
}

// TLS strategies, tried in order. See the comment at the top of this section
// for why the second and third ones exist.
const TLS_STRATEGIES = [
  {
    name: 'native',
    options: {}
  },
  {
    name: 'native-tls12-rsa',
    options: {
      maxVersion: 'TLSv1.2',
      ciphers: 'AES256-GCM-SHA384:AES128-GCM-SHA256:AES128-SHA'
    }
  },
  {
    name: 'forge',
    forge: true
  }
]

// "host:port" -> strategy that worked, so the fallbacks only cost one
// reconnect per server rather than on every session.
const tlsStrategyByHost = new Map()

function getStrategyOrder (cacheKey) {
  const cached = tlsStrategyByHost.get(cacheKey)
  if (!cached) return TLS_STRATEGIES
  return [cached, ...TLS_STRATEGIES.filter((s) => s !== cached)]
}

/**
 * Perform the RDCleanPath proxy handshake:
 * 1. TCP connect to RDP server (optionally through proxy)
 * 2. Send X.224 Connection Request (raw TCP)
 * 3. Read X.224 Connection Confirm (raw TCP)
 * 4. TLS handshake (native, or node-forge as a fallback)
 * 5. Extract server certificates
 *
 * @param {string} host
 * @param {number} port
 * @param {Buffer} x224Request - X.224 Connection Request bytes
 * @param {object} options - Optional settings
 * @param {string} options.proxy - Proxy URL (e.g., 'socks5://127.0.0.1:1080' or 'http://proxy:8080')
 * @param {number} options.readyTimeout - Connection timeout in ms
 * @returns {Promise<{ x224Response: Buffer, certChain: Buffer[], transport: TlsTransport, tcpSocket: net.Socket }>}
 */
async function performRDPHandshake (host, port, x224Request, options = {}) {
  const logPrefix = `${LOG_PREFIX} [${host}:${port}]`
  const cacheKey = `${host}:${port}`
  const strategies = getStrategyOrder(cacheKey)
  let lastErr

  for (const strategy of strategies) {
    // Step 1: TCP connect (direct or through proxy)
    let tcpSocket
    try {
      tcpSocket = await createTcpConnection(host, port, options, x224Request, logPrefix)
    } catch (err) {
      // Not a TLS problem: other strategies would fail the same way.
      throw new Error(`Connection failed: ${err.message}`)
    }

    // Step 2-3: read the X.224 Connection Confirm
    let x224Response
    let rest
    try {
      ({ x224Response, rest } = await readX224Confirm(tcpSocket, logPrefix))
    } catch (err) {
      tcpSocket.destroy()
      throw err
    }

    // Step 4-5: TLS handshake + certificate chain
    try {
      let upgrade
      if (strategy.forge) {
        upgrade = await forgeTlsUpgrade(tcpSocket, rest, logPrefix)
      } else {
        upgrade = await nativeTlsUpgrade(tcpSocket, host, rest, strategy.options, logPrefix)
      }

      log.debug(`${logPrefix} ✓ TLS via ${strategy.name}, extracted ${upgrade.certChain.length} certificate(s)`)
      tlsStrategyByHost.set(cacheKey, strategy)

      return {
        x224Response: Buffer.from(x224Response),
        certChain: upgrade.certChain,
        transport: upgrade.transport,
        tcpSocket
      }
    } catch (err) {
      lastErr = err
      log.warn(`${logPrefix} TLS strategy "${strategy.name}" failed: ${err.message}`)
      try { tcpSocket.destroy() } catch (_) {}
    }
  }

  throw lastErr || new Error('TLS handshake failed')
}

// ────────────────────────────────────────────────────
// Bidirectional Relay: WebSocket ↔ TLS ↔ TCP
// ────────────────────────────────────────────────────

/**
 * Set up bidirectional relay between a WebSocket and a TLS transport.
 *
 * Browser (WASM) → WebSocket → Proxy → TLS → TCP → RDP Server
 * RDP Server → TCP → TLS → Proxy → WebSocket → Browser (WASM)
 *
 * @param {WebSocket} ws - The WebSocket connection to the browser
 * @param {TlsTransport} transport
 */
function setupRelay (ws, transport) {
  let wsBytesForwarded = 0
  let tlsBytesForwarded = 0
  let paused = false
  let drainTimer = null
  let done = false

  const logPrefix = `${LOG_PREFIX} [relay]`

  const stopDrainPoll = () => {
    if (drainTimer) {
      clearInterval(drainTimer)
      drainTimer = null
    }
  }

  const cleanup = (source) => {
    if (done) return
    done = true
    log.debug(`${logPrefix} ${source} closed — WS→TLS: ${wsBytesForwarded} bytes, TLS→WS: ${tlsBytesForwarded} bytes`)
    stopDrainPoll()
    transport.destroy()
    if (ws.readyState === 1 /* OPEN */) {
      try { ws.close() } catch (_) {}
    }
  }

  // RDP Server → TLS → WebSocket
  transport.onData((buf) => {
    tlsBytesForwarded += buf.length
    if (ws.readyState !== 1 /* OPEN */) return
    try {
      ws.send(buf)
    } catch (err) {
      log.error(`${logPrefix} TLS→WS write error:`, err.message)
      return
    }

    if (!paused && ws.bufferedAmount > MAX_WS_BUFFER) {
      paused = true
      transport.pause()
      log.debug(`${logPrefix} renderer is behind (${ws.bufferedAmount} bytes queued), pausing server side`)
      drainTimer = setInterval(() => {
        if (ws.readyState !== 1) {
          stopDrainPoll()
          return
        }
        if (ws.bufferedAmount > WS_BUFFER_LOW) return
        stopDrainPoll()
        paused = false
        log.debug(`${logPrefix} renderer caught up, resuming server side`)
        transport.resume()
      }, DRAIN_POLL_INTERVAL)
    }
  })

  // WebSocket → TLS → RDP Server (browser → remote, e.g. input events)
  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    wsBytesForwarded += buf.length
    try {
      transport.send(buf)
    } catch (err) {
      log.error(`${logPrefix} WS→TLS write error:`, err.message)
    }
  })

  transport.onClose(() => cleanup('TLS'))
  transport.onError((err) => {
    log.error(`${logPrefix} TLS error:`, err.message)
    cleanup('TLS (error)')
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

      // Step 3-5: TCP + X.224 + TLS + Certs
      const { x224Response, certChain, transport } = await performRDPHandshake(
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

      // Step 7: Bidirectional relay
      setupRelay(ws, transport)
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
  setupRelay
}
