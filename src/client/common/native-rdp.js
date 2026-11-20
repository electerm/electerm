/**
 * Send an RDP bookmark to the local Windows RDP client (mstsc.exe).
 *
 * Windows only, and desktop app only: `window.pre.isWin` in the web app is the
 * platform of the machine running the electerm server, not of the browser that
 * would have to start mstsc.
 *
 * The work happens in the main process (src/app/lib/native-rdp-win.js, exposed
 * as 'launchNativeRdp' / 'clearRdpCredential' in src/app/lib/ipc.js).
 *
 * 'rdp' is spelled out instead of importing constants.js for the same reason
 * parse-quick-connect.js does: constants.js pulls in the logo .png files and
 * window, which would make this module unloadable under plain node.
 */
import { isWin } from './platform.js'
import message from '../components/common/message'

const RDP_TYPE = 'rdp'

export function canUseNativeRdp () {
  return isWin && !window.et.isWebApp
}

/**
 * Is this tab a bookmark that asks for the local client on a platform that has
 * one?
 * @param {object} tab
 * @returns {boolean}
 */
export function isNativeRdpTab (tab) {
  return !!tab &&
    tab.type === RDP_TYPE &&
    !!tab.nativeRdp &&
    canUseNativeRdp()
}

/**
 * Electron wraps a rejected main-process call as
 * "Error invoking remote method 'async': Error: <the real message>", which is
 * noise in a toast. The webapp never gets here (see canUseNativeRdp).
 * @param {*} err
 * @returns {string}
 */
function errorText (err) {
  const raw = String((err && err.message) || err || 'unknown error')
  const match = raw.match(/Error invoking remote method '[^']*': (?:Error: )?([\s\S]*)$/)
  return (match ? match[1] : raw).trim()
}

/**
 * Start the local client. Never throws: addTab is synchronous and the user gets
 * the result as a message.
 * @param {object} tab
 * @returns {Promise<*>}
 */
export function openNativeRdp (tab) {
  if (!window.pre || typeof window.pre.runGlobalAsync !== 'function') {
    // same guard host-check.jsx uses: 'not available in this version'
    message.error('the local RDP client is not available in this build')
    return
  }
  const host = tab.host || ''
  const payload = {
    host,
    port: tab.port,
    username: tab.username,
    password: tab.password,
    domain: tab.domain,
    // the bookmark's own choice, same field the built-in client uses
    nla: tab.nla !== false
  }
  // mstsc connects from this machine on its own: a socks proxy or a connection
  // hop through ssh is something only the built-in client can do. Say so
  // instead of quietly connecting without them.
  const ignored = []
  if (tab.proxy) {
    ignored.push('proxy')
  }
  if (tab.connectionHoppings && tab.connectionHoppings.length) {
    ignored.push('connection hopping')
  }
  return window.pre.runGlobalAsync('launchNativeRdp', payload)
    .then(res => {
      message.success(`opened ${host} with the local RDP client`)
      if (ignored.length) {
        message.warning(`the local RDP client ignores ${ignored.join(' and ')}`)
      }
      // cmdkey refused the password (a double quote in it, most likely): the
      // connection still opens, mstsc just asks for the password itself
      if (tab.password && res && res.credentialStored === false) {
        message.warning('the password could not be saved for the local RDP client, it will ask for it')
      }
    })
    .catch(err => {
      message.error(`cannot open ${host} with the local RDP client: ${errorText(err)}`)
    })
}
