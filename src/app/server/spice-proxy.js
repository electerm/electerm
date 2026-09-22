const net = require('net')
const tls = require('tls')
const log = require('../common/log')
const proxySock = require('./socks')

const LOG_PREFIX = '[SPICE-PROXY]'

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

function isIpAddress (host) {
  if (!host) {
    return false
  }
  return IPV4_RE.test(host) || host.includes(':')
}

/**
 * Parse an X.509 subject in the comma separated form spice-gtk expects, e.g.
 * "OU=PVE Cluster Node,O=Proxmox Virtual Environment,CN=pve1".
 *
 * Proxmox produces this string with X509_NAME_oneline() and then rewrites
 * "/key=" into ",key=" (PVE::AccessControl::read_x509_subject_spice, "we use
 * comma as separator (not '/')"), so commas are the real-world separator.
 *
 * Escaping follows spice-common/ssl_verify.c: a backslash escapes only a
 * following backslash or comma; anything else is an error there, and is kept
 * verbatim here rather than rejected.
 *
 * @param {string} str
 * @returns {Array<[string, string]>} uppercased key / value pairs, [] if the
 *   string is not a well formed list
 */
function parseSubject (str) {
  const text = String(str)
  const pairs = []
  let key = ''
  let value = ''
  let inValue = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '\\' && (text[i + 1] === '\\' || text[i + 1] === ',')) {
      if (inValue) {
        value += text[++i]
      } else {
        key += text[++i]
      }
      continue
    }

    if (!inValue) {
      if (char === ' ') {
        continue // leading spaces before a key are not significant
      }
      if (char === '=') {
        inValue = true
        continue
      }
      if (char === ',') {
        return [] // assignment is missing
      }
      key += char
      continue
    }

    if (char === ',') {
      if (!value) {
        return [] // empty value
      }
      pairs.push([key.toUpperCase(), value])
      key = ''
      value = ''
      inValue = false
      continue
    }
    value += char
  }

  if (!inValue || !key || !value) {
    return []
  }
  pairs.push([key.toUpperCase(), value])
  return pairs
}

function formatSubject (cert) {
  const subject = (cert && cert.subject) || {}
  return Object.keys(subject)
    .map(k => `${k}=${subject[k]}`)
    .join(',')
}

/**
 * Compare a .vv `host-subject` against the peer certificate subject.
 *
 * virt-viewer hands this string to spice-gtk's `cert-subject`, and it is the
 * only check that can work when the file also uses the Proxmox proxy: the
 * `host` key there is a signed ticket, not a name the certificate could ever
 * carry (see PVE::AccessControl::remote_viewer_config, which passes the
 * proxyticket as `host` and comments that this breaks hostname verification).
 *
 * The rules are spice-common/ssl_verify.c's verify_subject(), because the whole
 * point of honouring host-subject is to accept exactly what remote-viewer
 * accepts:
 *   - the number of entries must be equal, so a file naming a subset of the
 *     certificate's fields does NOT match;
 *   - every key/value pair must be equal.
 *
 * Order is deliberately not compared. X509_NAME_cmp() compares canonical
 * encodings and so is order sensitive, but Proxmox builds the string from the
 * certificate itself and a DN's order carries no meaning, so comparing as a set
 * only ever accepts a hand written file that remote-viewer would have rejected
 * for an irrelevant reason.
 *
 * @param {string} expected - the .vv host-subject value
 * @param {object} cert - PeerCertificate from tls
 * @returns {boolean}
 */
function subjectMatches (expected, cert) {
  const pairs = parseSubject(expected)
  const subject = (cert && cert.subject) || {}
  if (!pairs.length) {
    return false
  }
  const entries = Object.keys(subject).reduce(
    (n, key) => n + (Array.isArray(subject[key]) ? subject[key].length : 1),
    0
  )
  if (entries !== pairs.length) {
    return false
  }
  return pairs.every(([key, value]) => {
    const actual = subject[key]
    if (actual === undefined) {
      return false
    }
    return Array.isArray(actual)
      ? actual.some(v => String(v).trim() === value)
      : String(actual).trim() === value
  })
}

/**
 * Open the raw TCP connection, directly or through the configured proxy.
 * @returns {Promise<net.Socket>}
 */
function createRawSocket (host, port, options = {}) {
  const { proxy, readyTimeout = 15000 } = options

  if (proxy) {
    log.debug(`${LOG_PREFIX} Connecting through proxy: ${proxy}`)
    return proxySock({
      readyTimeout,
      host,
      port,
      proxy
    }).then(proxyResult => {
      log.debug(`${LOG_PREFIX} Proxy connection established`)
      return proxyResult.socket
    })
  }

  return new Promise((resolve, reject) => {
    const tcpSocket = net.createConnection({ host, port }, () => {
      log.debug(`${LOG_PREFIX} TCP connection established to ${host}:${port}`)
      tcpSocket.setKeepAlive(true, 5000)
      tcpSocket.setTimeout(0)
      resolve(tcpSocket)
    })
    tcpSocket.once('error', (err) => {
      reject(new Error(`TCP connection failed: ${err.message}`))
    })
    tcpSocket.setTimeout(readyTimeout, () => {
      tcpSocket.destroy()
      reject(new Error('Connection timed out'))
    })
  })
}

/**
 * Wrap an established socket in TLS, the way spice-gtk does for a tls-port.
 *
 * Two deliberate differences from a plain `tls.connect(host, port)`:
 *   - SNI is only sent for a real hostname. spice-gtk skips it for IPs, and a
 *     Proxmox `host` is a ticket string that must not end up in SNI.
 *   - The chain is only verified when the file carried a `ca`. Without one
 *     there is nothing to verify against, so the connection is allowed but the
 *     peer is not authenticated; a `host-subject` is still enforced.
 *
 * @param {net.Socket} socket - already connected socket
 * @param {object} options - { host, ca, hostSubject, readyTimeout }
 * @returns {Promise<tls.TLSSocket>}
 */
function createTlsConnection (socket, options = {}) {
  const {
    host,
    ca,
    hostSubject,
    readyTimeout = 15000
  } = options

  return new Promise((resolve, reject) => {
    let settled = false

    const fail = (err) => {
      if (settled) {
        return
      }
      settled = true
      try {
        socket.destroy()
      } catch (e) {}
      reject(err)
    }

    const tlsSocket = tls.connect({
      socket,
      servername: isIpAddress(host) ? undefined : host,
      ca: ca || undefined,
      rejectUnauthorized: !!ca,
      // With host-subject in play the peer certificate is checked below, so
      // Node's own hostname check is skipped; without it, the default applies.
      checkServerIdentity: hostSubject
        ? () => undefined
        : (hostname, cert) => tls.checkServerIdentity(host, cert)
    })

    tlsSocket.once('secureConnect', () => {
      if (settled) {
        return
      }
      const cert = tlsSocket.getPeerCertificate()
      if (hostSubject && !subjectMatches(hostSubject, cert)) {
        fail(new Error(
          `TLS certificate subject "${formatSubject(cert)}" ` +
          `does not match host-subject "${hostSubject}"`
        ))
        return
      }
      settled = true
      // Log the peer rather than `host`: with a Proxmox file `host` is a ticket
      // string, and the real peer is whatever the proxy forwarded to.
      log.debug(
        `${LOG_PREFIX} TLS connection established to ` +
        `${tlsSocket.remoteAddress}:${tlsSocket.remotePort} ` +
        `(${tlsSocket.getProtocol()}, subject ${formatSubject(cert)})`
      )
      tlsSocket.setKeepAlive(true, 5000)
      tlsSocket.setTimeout(0)
      resolve(tlsSocket)
    })

    tlsSocket.once('error', (err) => {
      fail(new Error(`TLS connection failed: ${err.message}`))
    })
    tlsSocket.setTimeout(readyTimeout, () => {
      fail(new Error('TLS handshake timed out'))
    })
  })
}

/**
 * Connect to a SPICE server, plain TCP or TLS.
 * @param {string} host
 * @param {number} port
 * @param {object} options - { proxy, readyTimeout, tls, ca, hostSubject }
 * @returns {Promise<net.Socket|tls.TLSSocket>}
 */
async function createTcpConnection (host, port, options = {}) {
  const { proxy, readyTimeout = 15000, tls: useTls, ca, hostSubject } = options
  const socket = await createRawSocket(host, port, { proxy, readyTimeout })

  if (!useTls) {
    return socket
  }

  return createTlsConnection(socket, { host, ca, hostSubject, readyTimeout })
}

async function handleConnection (ws, options = {}) {
  const {
    host,
    port,
    proxy,
    tls: useTls,
    ca,
    hostSubject,
    readyTimeout = 15000,
    onCleanup,
    channelId
  } = options
  const id = channelId || 'unknown'

  log.debug(`${LOG_PREFIX}[${id}] New WebSocket connection for SPICE proxy`)

  if (!host || !port) {
    log.error(`${LOG_PREFIX}[${id}] Missing host or port`)
    ws.close()
    if (onCleanup) onCleanup()
    return
  }

  const messageBuffer = []
  let wsClosed = false
  let tcpClosed = false
  let tcpSocket = null

  const cleanup = (source) => {
    if (wsClosed && tcpClosed) return
    log.debug(`${LOG_PREFIX}[${id}] Cleanup triggered by: ${source}`)
    wsClosed = true
    tcpClosed = true

    try {
      if (ws && ws.readyState !== ws.CLOSED) {
        ws.close()
      }
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] WebSocket close error:`, e.message)
    }

    try {
      if (tcpSocket) {
        tcpSocket.destroy()
      }
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] TCP socket destroy error:`, e.message)
    }

    if (onCleanup) {
      onCleanup()
    }
  }

  ws.on('message', (data) => {
    if (tcpClosed) return
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)

    if (tcpSocket) {
      try {
        tcpSocket.write(buf)
      } catch (e) {
        log.error(`${LOG_PREFIX}[${id}] TCP write error:`, e.message)
        cleanup('TCP write error')
      }
    } else {
      messageBuffer.push(buf)
    }
  })

  ws.on('close', () => cleanup('WebSocket'))
  ws.on('error', (err) => {
    log.error(`${LOG_PREFIX}[${id}] WebSocket error:`, err.message)
    cleanup('WebSocket error')
  })

  try {
    tcpSocket = await createTcpConnection(host, port, {
      proxy,
      readyTimeout,
      tls: useTls,
      ca,
      hostSubject
    })
    log.debug(`${LOG_PREFIX}[${id}] Connected to SPICE server at ${host}:${port}`)

    tcpSocket.on('data', (data) => {
      if (wsClosed) return
      try {
        ws.send(data)
      } catch (e) {
        log.error(`${LOG_PREFIX}[${id}] WebSocket send error:`, e.message)
        cleanup('WebSocket send error')
      }
    })

    tcpSocket.on('close', () => cleanup('TCP close'))
    tcpSocket.on('end', () => cleanup('TCP end'))
    tcpSocket.on('error', (err) => {
      log.error(`${LOG_PREFIX}[${id}] TCP error:`, err.message)
      cleanup('TCP error')
    })

    if (messageBuffer.length > 0) {
      for (const buf of messageBuffer) {
        try {
          tcpSocket.write(buf)
        } catch (e) {
          log.error(`${LOG_PREFIX}[${id}] TCP write error:`, e.message)
          cleanup('TCP write error')
          return
        }
      }
      messageBuffer.length = 0
    }
  } catch (err) {
    log.error(`${LOG_PREFIX}[${id}] Connection failed:`, err.message)
    try {
      ws.close()
    } catch (e) {}
    if (onCleanup) onCleanup()
  }
}

function setupRelay (ws, tcpSocket, options = {}) {
  const { onCleanup, channelId } = options
  let wsClosed = false
  let tcpClosed = false
  const id = channelId || 'unknown'

  const cleanup = (source) => {
    if (wsClosed && tcpClosed) return
    log.debug(`${LOG_PREFIX}[${id}] Cleanup triggered by: ${source}`)
    wsClosed = true
    tcpClosed = true

    try {
      if (ws && ws.readyState !== ws.CLOSED) {
        ws.close()
      }
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] WebSocket close error:`, e.message)
    }

    try {
      tcpSocket.destroy()
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] TCP socket destroy error:`, e.message)
    }

    if (onCleanup) {
      onCleanup()
    }
  }

  tcpSocket.on('data', (data) => {
    if (wsClosed) return
    try {
      ws.send(data)
    } catch (e) {
      log.error(`${LOG_PREFIX}[${id}] WebSocket send error:`, e.message)
      cleanup('WebSocket send error')
    }
  })

  tcpSocket.on('close', () => cleanup('TCP close'))
  tcpSocket.on('end', () => cleanup('TCP end'))
  tcpSocket.on('error', (err) => {
    log.error(`${LOG_PREFIX}[${id}] TCP error:`, err.message)
    cleanup('TCP error')
  })

  ws.on('message', (data) => {
    if (tcpClosed) return
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    try {
      tcpSocket.write(buf)
    } catch (e) {
      log.error(`${LOG_PREFIX}[${id}] TCP write error:`, e.message)
      cleanup('TCP write error')
    }
  })

  ws.on('close', () => cleanup('WebSocket'))
  ws.on('error', (err) => {
    log.error(`${LOG_PREFIX}[${id}] WebSocket error:`, err.message)
    cleanup('WebSocket error')
  })
}

module.exports = {
  handleConnection,
  createTcpConnection,
  createTlsConnection,
  subjectMatches,
  setupRelay
}
