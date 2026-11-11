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
 *
 * Those reserved ranges are also contiguous and often far wider than any sane
 * `tries`, so walking on from `from` can burn every try and still be inside
 * the block (WSL2 is the usual culprit). Once the sequential window is spent
 * we jump around the port space instead of giving up: a random probe is the
 * only way out of a block that starts where we start.
 */

const net = require('net')

const DEFAULT_HOST = '127.0.0.1'
const MAX_PORT = 65535
const DEFAULT_FROM = 30975
const DEFAULT_TRIES = 500
const DEFAULT_RANDOM_TRIES = 200
const RANDOM_MIN_PORT = 10000
const RANDOM_MAX_PORT = 65000
// an unseen random candidate is all we need; do not spin forever when the
// caller narrowed the range down to a handful of ports
const RANDOM_PICK_ATTEMPTS = 20

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
 * a port from [min, max] that `seen` does not hold yet, or null
 * @param {number} min
 * @param {number} max
 * @param {Set<number>} seen
 * @returns {number|null}
 */
function randomPort (min, max, seen) {
  for (let i = 0; i < RANDOM_PICK_ATTEMPTS; i++) {
    const port = min + Math.floor(Math.random() * (max - min + 1))
    if (!seen.has(port)) {
      return port
    }
  }
  return null
}

/**
 * first port that can be bound: walk on from `from`, then try random ports
 * @param {object} opts
 * @param {number} opts.from first candidate port
 * @param {string} opts.host
 * @param {number} opts.tries how many candidates to walk before falling back
 * @param {number} opts.randomTries random candidates to try after that
 * @param {number[]} opts.randomRange [min, max] for the random candidates
 * @param {function} opts.probe bind probe, for tests
 * @returns {Promise<number>}
 */
async function getFreePort ({
  from = DEFAULT_FROM,
  host = DEFAULT_HOST,
  tries = DEFAULT_TRIES,
  randomTries = DEFAULT_RANDOM_TRIES,
  randomRange = [RANDOM_MIN_PORT, RANDOM_MAX_PORT],
  probe = tryBind
} = {}) {
  const seen = new Set()
  for (let i = 0; i < tries; i++) {
    const port = from + i
    if (port > MAX_PORT) {
      break
    }
    seen.add(port)
    try {
      return await probe(port, host)
    } catch (err) {
      // EADDRINUSE: someone is listening, EACCES: Windows reserved range or a
      // blocking firewall/AV, EADDRNOTAVAIL: host not there. Same answer for
      // all of them -- not this port, try the next one.
    }
  }

  // the sequential window is spent: it may sit entirely inside a reserved
  // block, so probe elsewhere in the port space
  const [min, max] = randomRange
  for (let i = 0; i < randomTries; i++) {
    const port = randomPort(min, max, seen)
    if (port === null) {
      break
    }
    seen.add(port)
    try {
      return await probe(port, host)
    } catch (err) {
      // same as above, not this one either
    }
  }
  throw new Error(
    `no free port found from ${from} (tried ${tries})` +
    `, then ${randomTries} random ports in ${min}-${max}`
  )
}

module.exports = { getFreePort, tryBind }
