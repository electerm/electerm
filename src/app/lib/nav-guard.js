/**
 * Keep the main window on the app's own origin.
 *
 * The preload script is attached to the main window, and Electron re-runs it
 * on every document that lands in that webContents. So a navigation is not
 * just a UI accident: the new document inherits `window.api` and can call the
 * main process through it. The IPC side can only see "a call from the app
 * window's webContents", which a navigated window still is, so the origin of
 * that window has to be enforced here as well (see isTrustedIpcSender in
 * ./ipc.js). Reported as GHSA-g83m-h25x-x2xf.
 *
 * `webContents.loadURL` does not emit will-navigate / will-redirect, so our
 * own loads (the app URL, the did-fail-load error page) are unaffected.
 */

function parseOrigin (url) {
  try {
    return new URL(url).origin
  } catch (_) {
    return ''
  }
}

function isSameOrigin (url, origin) {
  return !!origin && parseOrigin(url) === origin
}

// Only hand schemes the OS can actually route to the browser. file:, data:,
// javascript: and electerm:// links in untrusted content go nowhere instead
// of being dispatched to whatever happens to be registered for them.
const EXTERNAL_SCHEME = /^(https?|mailto):/i

function openInBrowser (shell, url) {
  if (EXTERNAL_SCHEME.test(url)) {
    shell.openExternal(url)
  }
}

/**
 * @param {Electron.BrowserWindow} win
 * @param {string} appURL the url we are about to load into the window
 * @param {{openExternal: Function}} shell
 * @returns {string} the app origin, to be reused by the IPC sender check
 */
function installNavGuard (win, appURL, shell) {
  const origin = parseOrigin(appURL)
  if (!origin) {
    throw new Error('installNavGuard: appURL must be an absolute url')
  }
  const wc = win.webContents
  const block = (event, url) => {
    if (isSameOrigin(url, origin)) {
      return
    }
    event.preventDefault()
    openInBrowser(shell, url)
  }
  wc.on('will-navigate', block)
  wc.on('will-redirect', block)
  // window.open / middle-click on a link: never create a second window. It
  // would inherit these webPreferences, preload script included.
  wc.setWindowOpenHandler(({ url }) => {
    openInBrowser(shell, url)
    return { action: 'deny' }
  })
  return origin
}

exports.parseOrigin = parseOrigin
exports.isSameOrigin = isSameOrigin
exports.installNavGuard = installNavGuard
