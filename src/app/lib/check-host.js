/**
 * is a host up, asked before an rdp connect: a sleeping or switched off
 * host otherwise costs the full tcp timeout (~21s on windows) before the
 * connect fails. Ping first; windows blocks ping by default on some
 * networks, so when it gets no answer the service port is tried too.
 */

const net = require('net')
const { execFile } = require('child_process')

const pingTimeout = 1500

function pingArgs (host, platform = process.platform) {
  if (platform === 'win32') {
    // ipv4: ipv6 replies carry no TTL to check, the port check covers v6
    return ['-4', '-n', '1', '-w', String(pingTimeout), host]
  }
  if (platform === 'darwin') {
    return ['-c', '1', '-t', '2', host]
  }
  return ['-c', '1', '-W', '2', host]
}

/**
 * windows ping exits 0 for "destination host unreachable" answered by a
 * router, only a reply with a TTL is the host itself
 */
function pingAnswered (code, stdout) {
  return code === 0 && /ttl[=:]/i.test(stdout)
}

function ping (host) {
  return new Promise(resolve => {
    execFile('ping', pingArgs(host), {
      windowsHide: true,
      timeout: pingTimeout + 3000
    }, (err, stdout) => {
      resolve(pingAnswered(err ? err.code || 1 : 0, String(stdout || '')))
    })
  })
}

function tcpOpen (host, port, timeout = pingTimeout) {
  return new Promise(resolve => {
    const sock = net.createConnection({ host, port })
    const done = ok => {
      sock.destroy()
      resolve(ok)
    }
    sock.setTimeout(timeout, () => done(false))
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
  })
}

/**
 * @param {string} host
 * @param {number} [port] service port tried when ping gets no answer
 * @return {Promise<{ok: boolean, ping: boolean, port: boolean, error?: string}>}
 */
async function checkHost (host, port) {
  host = String(host || '').trim()
  // never an option or a second argument for ping
  if (!host || host.startsWith('-') || /\s/.test(host)) {
    return { ok: false, ping: false, port: false, error: 'invalid host' }
  }
  if (await ping(host)) {
    return { ok: true, ping: true, port: false }
  }
  const p = parseInt(port, 10)
  const open = p > 0 && p < 65536 ? await tcpOpen(host, p) : false
  return { ok: open, ping: false, port: open }
}

module.exports = {
  checkHost,
  tcpOpen,
  pingArgs,
  pingAnswered
}
