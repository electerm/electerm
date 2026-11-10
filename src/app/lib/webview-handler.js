const { ipcMain, webContents } = require('electron')

// Credentials belong to the origin the prompt was raised for, not to the guest
// tab: a webContents id stays the same across navigations and across
// cross-origin subresource requests (GHSA-3mh6-qf3v-q6cr).
const credentialsMap = new Map() // webContentsId -> { username, password, origin }
const authRequestMap = new Map() // requestId -> { webContentsId, origin }
const initializedSessions = new Set()

let authRequestId = 0
let windowCount = 0

// The legacy artifacts pin Electron 22.3.27 / Node 16 (linux-legacy, linux-arm,
// linux-arm-legacy, linux-loong64-legacy, mac-10, win7-tar), while master ships
// Electron 44. Everything here exists in both: `details.url`, `new URL()`,
// `Buffer`, `setPermissionCheckHandler`, and `onBeforeSendHeaders([filter, ]fn)`.
// `details.webContentsId` is optional on both versions, so requests where it is
// absent fall back to the older `details.webContents.id`; if neither is present
// the request gets no credentials (fail closed). `details.initiatorOrigin` is
// not available on Electron 22 and would be wrong anyway -- Chromium keeps it
// from the original request across redirects, so an A -> B redirect would
// still inherit A's credentials.
function getOrigin (url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.origin
      : ''
  } catch (e) {
    return ''
  }
}

// Permission checks can arrive with a null webContents (service workers,
// notifications, cross-origin subframes) on Electron 22 as well as 44.
function isGuestWebContents (wc) {
  return !!wc && typeof wc.getType === 'function' &&
    wc.getType() === 'webview'
}

const onAuthResponse = (event, data) => {
  const { id, username, password } = data
  const entry = authRequestMap.get(id)
  if (!entry) return

  const { webContentsId } = entry
  authRequestMap.delete(id)

  if (username && password && entry.origin) {
    credentialsMap.set(webContentsId, {
      username,
      password,
      origin: entry.origin
    })
    // Reload the webview to apply new credentials
    try {
      const wc = webContents.fromId(webContentsId)
      if (wc) {
        wc.reload()
      }
    } catch (e) {
      console.error('Failed to reload webview:', e)
    }
  } else {
    credentialsMap.delete(webContentsId)
  }
}

// A web session renders a URL the user did not write: it arrives from a
// quick-connect paste, a command-line argument, an electerm:// deep link or an
// MCP call. The renderer used to create that <webview> with
// `disablewebsecurity='true'`, which turns off the same-origin policy for the
// guest and lets the page read every other origin the machine can reach
// (GHSA-m7mf-jvqh-8wwh). The attribute is gone from the component; this handler
// is the second lock, so a renderer change alone cannot weaken a guest again.
const GUEST_DENIED_PERMISSIONS = new Set([
  'media', 'geolocation', 'midi', 'midiSysex', 'hid', 'serial', 'usb',
  'idle-detection', 'clipboard-read'
])

function hardenWebview (event, webPreferences, params) {
  // a guest page never gets a preload, node, or the ability to nest webviews
  delete webPreferences.preload
  delete webPreferences.preloadURL
  webPreferences.nodeIntegration = false
  webPreferences.nodeIntegrationInSubFrames = false
  webPreferences.webviewTag = false
  webPreferences.contextIsolation = true
  // same-origin policy and mixed-content blocking stay on, whatever the
  // renderer asked for in the attributes
  webPreferences.webSecurity = true
  webPreferences.allowRunningInsecureContent = false
  // a web session opens web pages; file:// and app-internal schemes are not
  // part of the feature and would expose local files to a remote page
  if (!/^https?:\/\//i.test(params.src || '')) {
    event.preventDefault()
  }
}

function init (mainWindow) {
  windowCount++

  // Listen for auth response from renderer if not already listening
  if (ipcMain.listenerCount('webview-auth-response') === 0) {
    ipcMain.on('webview-auth-response', onAuthResponse)
  }

  mainWindow.webContents.on('will-attach-webview', hardenWebview)

  // Handle new webviews
  mainWindow.webContents.on('did-attach-webview', (event, viewWebContents) => {
    setupWebview(viewWebContents, mainWindow)

    // Clean up when webview is destroyed
    viewWebContents.once('destroyed', () => {
      credentialsMap.delete(viewWebContents.id)
      // Remove any pending requests for this webview
      for (const [reqId, entry] of authRequestMap.entries()) {
        if (entry.webContentsId === viewWebContents.id) {
          authRequestMap.delete(reqId)
        }
      }
    })
  })

  mainWindow.on('closed', () => {
    windowCount--
    if (windowCount <= 0) {
      ipcMain.removeListener('webview-auth-response', onAuthResponse)
      credentialsMap.clear()
      authRequestMap.clear()
      initializedSessions.clear()
      windowCount = 0
    }
  })
}

function setupWebview (viewWebContents, mainWindow) {
  const session = viewWebContents.session

  // window.open() from a guest is how OAuth logins inside a web session work,
  // but an attacker page can use it too: allow plain http(s) popups only, and
  // never hand them a preload, node, or the webview tag.
  viewWebContents.setWindowOpenHandler?.(({ url }) => {
    if (!/^https?:\/\//i.test(url)) {
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webviewTag: false,
          webSecurity: true
        }
      }
    }
  })

  // Set up header injection if not already done for this session
  if (!initializedSessions.has(session)) {
    initializedSessions.add(session)

    // A web session has no business asking for devices; notifications,
    // fullscreen and clipboard write stay available for ordinary web apps.
    // The handler sits on the shared default session, so anything that is not a
    // guest keeps the previous (no handler) behaviour.
    session.setPermissionRequestHandler?.((wc, permission, callback) => {
      const granted = !isGuestWebContents(wc) ||
        !GUEST_DENIED_PERMISSIONS.has(permission)
      callback(granted)
    })

    // Permission checks and permission requests are separate Chromium paths.
    // Without a check handler Electron grants every check by default (see
    // ElectronPermissionManager::CheckPermissionWithDetails), so the denial
    // list above would only cover APIs that also issue a request. Mirror it.
    // webContents can be null for checks not tied to a document (service
    // workers, notifications); leave those at the previous default.
    session.setPermissionCheckHandler?.((wc, permission) => {
      return !(isGuestWebContents(wc) &&
        GUEST_DENIED_PERMISSIONS.has(permission))
    })

    // This listener sits on the shared default session, so without a filter it
    // runs for every request the app makes. Limit it to http(s), and never let
    // a malformed URL throw here: an exception would stall all those requests.
    const authFilter = { urls: ['http://*/*', 'https://*/*'] }
    session.webRequest.onBeforeSendHeaders(authFilter, (details, callback) => {
      // webContentsId is optional in the webRequest docs for Electron 22 and
      // 44 alike; on the older builds `webContents` is the reliable one.
      const wcId = details.webContentsId ?? details.webContents?.id
      const creds = credentialsMap.get(wcId)
      const requestHeaders = { ...details.requestHeaders }

      // Match on details.url, not initiatorOrigin: a redirect produces a new
      // request whose url is the destination, and that request must not carry
      // credentials meant for the origin the user actually typed them for.
      if (creds && creds.origin && getOrigin(details.url) === creds.origin) {
        const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
        requestHeaders.Authorization = `Basic ${auth}`
      }

      // eslint-disable-next-line n/no-callback-literal
      callback({ requestHeaders })
    })
  }

  // Listen for navigation and check for auth challenges (text-based)
  viewWebContents.on('dom-ready', () => {
    checkAuthStatus(viewWebContents, mainWindow)
  })

  viewWebContents.on('did-navigate', (event, url) => {
    // Leaving the origin invalidates the credentials for this tab: they should
    // not linger in memory or be revived by a later history navigation.
    const creds = credentialsMap.get(viewWebContents.id)
    if (creds && getOrigin(url) !== creds.origin) {
      credentialsMap.delete(viewWebContents.id)
    }
    // Small delay to ensure page is loaded
    setTimeout(() => checkAuthStatus(viewWebContents, mainWindow), 100)
  })

  // Initial check
  setTimeout(() => checkAuthStatus(viewWebContents, mainWindow), 500)
}

async function checkAuthStatus (viewWebContents, mainWindow) {
  if (viewWebContents.isDestroyed()) return

  try {
    const result = await viewWebContents.executeJavaScript(`
      (function() {
        // Check for various ways the 401 page might appear
        const bodyText = document.body ? document.body.textContent : '';
        const htmlText = document.documentElement ? document.documentElement.textContent : '';
        const allText = bodyText + htmlText;

        if (allText.includes('Access Error: Unauthorized')) {
          return { status: 'unauthorized' };
        } else if (allText.includes('Authentication Successful')) {
          return { status: 'authenticated' };
        }
        return { status: 'unknown' };
      })()
    `)

    if (result.status === 'unauthorized') {
      // Check if we've already requested auth for this webview
      const pendingRequest = Array.from(authRequestMap.values()).find(e => e.webContentsId === viewWebContents.id)
      if (pendingRequest) return

      // Record the origin now, before the guest can navigate anywhere else.
      const currentUrl = viewWebContents.getURL()
      const origin = getOrigin(currentUrl)
      if (!origin) return

      // Generate request ID
      authRequestId++
      const id = authRequestId

      authRequestMap.set(id, { webContentsId: viewWebContents.id, origin })

      mainWindow.webContents.send('webview-auth-request', {
        id,
        url: currentUrl,
        host: new URL(currentUrl).host,
        isProxy: false
      })
    }
  } catch (error) {
    // console.error('Check auth status error:', error);
  }
}

module.exports = {
  init
}
