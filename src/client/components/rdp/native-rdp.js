/**
 * Send an RDP bookmark to the local Windows RDP client (mstsc.exe).
 *
 * Windows only, and desktop app only: `window.pre.isWin` in the web app is the
 * platform of the machine running the electerm server, not of the browser that
 * would have to start mstsc.
 *
 * The work happens in the main process (src/app/lib/native-rdp-win.js, exposed
 * as 'launchNativeRdp' in src/app/lib/ipc.js).
 *
 * Which client opens a bookmark, and whether that leaves a tab, lives in
 * src/client/common/native-rdp.js instead: that module imports nothing but the
 * platform flags, so it can be unit tested under plain node. This one owns the
 * launch and therefore needs the message UI.
 */
import message from '../common/message'

// re-exported so call sites keep importing one module for the whole feature
export {
  canUseNativeRdp,
  isNativeRdpTab,
  opensWithoutTab,
  RDP_TYPE
} from '../../common/native-rdp.js'

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
 * Start the local client and report whether its process launched.
 * @param {object} tab
 * @returns {Promise<boolean>}
 */
export async function openNativeRdp (tab) {
  if (!window.pre || typeof window.pre.runGlobalAsync !== 'function') {
    // same guard host-check.jsx uses: 'not available in this version'
    message.error('the local RDP client is not available in this build')
    return false
  }
  const host = tab.host || ''
  const payload = {
    host,
    port: tab.port,
    username: tab.username,
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
  try {
    await window.pre.runGlobalAsync('launchNativeRdp', payload)
    if (ignored.length) {
      message.warning(`the local RDP client ignores ${ignored.join(' and ')}`)
    }
    return true
  } catch (err) {
    message.error(`cannot open ${host} with the local RDP client: ${errorText(err)}`)
    return false
  }
}
