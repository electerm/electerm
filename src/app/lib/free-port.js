/**
 * Pick a port we can actually listen on.
 *
 * The `find-free-port` package asks a different question than the one that
 * matters: it probes with net.createConnection() and calls anything it cannot
 * connect to "free". On Windows a port inside a reserved / excluded range
 * (Hyper-V, WinNAT, WSL2, Docker Desktop, some VPN and security software)
 * refuses the connection, so it looks free, and then listen() fails with
 * EACCES -- not even EADDRINUSE, so nothing would ever retry or fall through
 * to the next port. Probe by binding instead: either we get the port or we
 * move on.
 */

const net = require('net')

const DEFAULT_HOST = '127.0.0.1'
const MAX_PORT = 65535

/**
 * bind `port` (0 = any) and release it right away
 * @param {number} port
 * @param {string} host
 * @returns {Promise<number>} the port that was actually bound
 */
function tryBind (port, host = DEFAULT_HOST) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    let settled = false
    const settle = (err, value) => {
      if (settled) {
        return
      }
      settled = true
      server.removeAllListeners()
      if (err) {
        reject(err)
      } else {
        resolve(value)
      }
    }
    server.once('error', err => settle(err))
    server.listen(port, host, () => {
      const address = server.address()
      const boundPort = address && typeof address === 'object'
        ? address.port
        : port
      server.close(() => settle(null, boundPort))
    })
  })
}

/**
 * first port starting from `from` that can be bound
 * @param {object} opts
 * @param {number} opts.from first candidate port
 * @param {string} opts.host
 * @param {number} opts.tries how many candidates to walk before giving up
 * @param {function} opts.probe bind probe, for tests
 * @returns {Promise<number>}
 */
async function getFreePort ({
  from = 30975,
  host = DEFAULT_HOST,
  tries = 500,
  probe = tryBind
} = {}) {
  for (let i = 0; i < tries; i++) {
    const port = from + i
    if (port > MAX_PORT) {
      break
    }
    try {
      return await probe(port, host)
    } catch (err) {
      // EADDRINUSE: someone is listening, EACCES: Windows reserved range or a
      // blocking firewall/AV, EADDRNOTAVAIL: host not there. Same answer for
      // all of them -- not this port, try the next one.
    }
  }
  throw new Error(`no free port found from ${from} (tried ${tries})`)
}

module.exports = { getFreePort, tryBind }
