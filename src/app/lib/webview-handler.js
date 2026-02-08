const { ipcMain, webContents } = require('electron')

// Store credentials per webContents ID
const credentialsMap = new Map() // webContentsId -> { username, password }
const authRequestMap = new Map() // requestId -> { webContentsId }
const initializedSessions = new Set()

let authRequestId = 0
let windowCount = 0

const onAuthResponse = (event, data) => {
  const { id, username, password } = data
  const entry = authRequestMap.get(id)
  if (!entry) return

  const { webContentsId } = entry
  authRequestMap.delete(id)

  if (username && password) {
    credentialsMap.set(webContentsId, { username, password })
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

function init (mainWindow) {
  windowCount++

  // Listen for auth response from renderer if not already listening
  if (ipcMain.listenerCount('webview-auth-response') === 0) {
    ipcMain.on('webview-auth-response', onAuthResponse)
  }

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

  // Set up header injection if not already done for this session
  if (!initializedSessions.has(session)) {
    initializedSessions.add(session)

    session.webRequest.onBeforeSendHeaders((details, callback) => {
      const wcId = details.webContentsId
      const creds = credentialsMap.get(wcId)
      const requestHeaders = { ...details.requestHeaders }

      if (creds) {
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

  viewWebContents.on('did-navigate', () => {
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

      // Generate request ID
      authRequestId++
      const id = authRequestId

      authRequestMap.set(id, { webContentsId: viewWebContents.id })

      mainWindow.webContents.send('webview-auth-request', {
        id,
        url: viewWebContents.getURL(),
        host: new URL(viewWebContents.getURL()).host,
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
