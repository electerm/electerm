/**
 * x11 helpers
 *
 * electerm does not render x11 itself, it only forwards the protocol through
 * the ssh channel, so a local x server (XQuartz / VcXsrv / X.org) must be
 * running and reachable. When it is not, remote GUI apps hang or die without
 * any visible reason, so we probe the display up front and hand the user a
 * hint (see session-ssh.js `checkX11`).
 */

const net = require('net')

const X11_HELP_URL = 'https://github.com/electerm/electerm/wiki/Use-X11'
const unixSocketDir = '/tmp/.X11-unix'
const defaultTcpPort = 6000
const probeTimeout = 800

/**
 * endpoints to try when looking for a local x server, most likely first
 * @param {string} display raw DISPLAY value: ':0', 'localhost:1.0' or an
 *   absolute socket path (XQuartz on macOS)
 * @param {string} platform process.platform
 * @return {Array<{path?: string, port?: number, host?: string}>}
 */
function getX11Candidates (display, platform = process.platform) {
  const d = (display || '').trim()
  const list = []
  const add = (c) => {
    const exists = list.some(x => x.path === c.path && x.port === c.port)
    if (!exists) {
      list.push(c)
    }
  }
  // XQuartz: DISPLAY already is the socket path
  if (d.includes('/')) {
    add({ path: d })
    return list
  }
  const m = d.match(/:(\d+)(?:\.(\d+))?$/)
  const n = m ? parseInt(m[1], 10) : 0
  const onWindows = platform === 'win32'
  if (!onWindows) {
    add({ path: `${unixSocketDir}/X${n}` })
  }
  add({ port: defaultTcpPort + n, host: '127.0.0.1' })
  if (n !== 0) {
    if (!onWindows) {
      add({ path: `${unixSocketDir}/X0` })
    }
    add({ port: defaultTcpPort, host: '127.0.0.1' })
  }
  return list
}

function probeOne (endpoint, timeout) {
  return new Promise((resolve) => {
    let timer = null
    let done = false
    const finish = (r) => {
      if (done) {
        return
      }
      done = true
      if (timer) {
        clearTimeout(timer)
      }
      sock.destroy()
      resolve(r)
    }
    const sock = new net.Socket()
    timer = setTimeout(() => finish(false), timeout)
    sock
      .once('connect', () => finish(true))
      .once('error', () => finish(false))
    try {
      if (endpoint.path) {
        sock.connect(endpoint.path)
      } else {
        sock.connect(endpoint.port, endpoint.host || '127.0.0.1')
      }
    } catch (e) {
      finish(false)
    }
  })
}

/**
 * is any of the candidate endpoints connectable?
 * @param {Array} candidates from getX11Candidates
 * @param {number} timeout per endpoint, ms
 * @return {Promise<boolean>}
 */
function probeXServer (candidates, timeout = probeTimeout) {
  return candidates.reduce((prev, c) => {
    return prev.then(found => found || probeOne(c, timeout))
  }, Promise.resolve(false))
}

/**
 * hint shown when no local x server answers
 * @param {string} platform process.platform
 */
function x11Hint (platform = process.platform) {
  if (platform === 'darwin') {
    return 'X11 forwarding is on, but no local X server was found. Install and start XQuartz (https://www.xquartz.org), log out and back in so DISPLAY is set, then reconnect.'
  }
  if (platform === 'win32') {
    return 'X11 forwarding is on, but no local X server was found. Start VcXsrv (or Xming) with XLaunch on display number 0, keep "Disable access control" checked, make sure it listens on 127.0.0.1:6000, then reconnect.'
  }
  return 'X11 forwarding is on, but no local X server was found. Start your X session (or install an X server and xauth), then reconnect.'
}

/**
 * hint shown when the x server answers but we got no auth cookie
 * @param {string} platform process.platform
 */
function x11CookieHint (platform = process.platform) {
  const base = 'No X11 auth cookie could be read (xauth missing or no entry for the current display), the X server may reject remote GUI apps.'
  if (platform === 'darwin') {
    // XQuartz ships xauth at /opt/X11/bin, which is not on the PATH of apps
    // launched from Finder/Dock
    return `${base} XQuartz puts xauth in /opt/X11/bin, start electerm from a shell that has it on PATH, or turn off "Authenticate connections" in XQuartz settings.`
  }
  return `${base} Check with "xauth list", or open access with "xhost +localhost".`
}

module.exports = {
  X11_HELP_URL,
  getX11Candidates,
  probeXServer,
  x11Hint,
  x11CookieHint
}
