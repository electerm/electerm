/**
 * Deep link support for electerm
 * Handles protocol URLs like ssh://, telnet://, rdp://, vnc://, etc.
 */

const { app } = require('electron')
const log = require('../common/log')
const {
  isMac
} = require('../common/runtime-constants')
const globalState = require('./glob-state')
const { parseQuickConnect, SUPPORTED_PROTOCOLS } = require('../common/parse-quick-connect')
/**
 * Register electerm as a handler for supported protocols
 * Note: This makes electerm available as a handler but doesn't force it as default.
 * Users can still choose their preferred app in system settings.
 *
 * @param {boolean} force - If true, register even if not packaged (for testing)
 * @returns {object} - Status of registration for each protocol
 */
function registerDeepLink (force = false) {
  const protocols = SUPPORTED_PROTOCOLS
  const results = {}

  // Only register in packaged app or when explicitly requested
  const shouldRegister = app.isPackaged ||
                        force ||
                        process.env.ELECTERM_REGISTER_PROTOCOLS === '1'

  if (!shouldRegister) {
    log.info('Skipping protocol registration in development mode')
    log.info('Set ELECTERM_REGISTER_PROTOCOLS=1 or pass force=true to enable')
    return { registered: false, reason: 'development-mode' }
  }

  protocols.forEach(protocol => {
    // Check if already registered
    const isDefault = app.isDefaultProtocolClient(protocol)

    if (isDefault) {
      log.info(`Already registered as handler for ${protocol}:// protocol`)
      results[protocol] = { success: true, alreadyDefault: true }
    } else {
      const registered = app.setAsDefaultProtocolClient(protocol)
      if (registered) {
        log.info(`Registered as handler for ${protocol}:// protocol`)
        results[protocol] = { success: true, alreadyDefault: false }
      } else {
        log.warn(`Failed to register ${protocol}:// protocol handler`)
        results[protocol] = { success: false, error: 'registration-failed' }
      }
    }
  })

  return { registered: true, protocols: results }
}

/**
 * Check which protocols are currently registered
 * @returns {object} - Status of each protocol
 */
function checkProtocolRegistration () {
  const protocols = SUPPORTED_PROTOCOLS
  const status = {}

  protocols.forEach(protocol => {
    status[protocol] = app.isDefaultProtocolClient(protocol)
  })

  return status
}

/**
 * Unregister electerm as handler for protocols
 * @param {Array<string>} protocols - Optional array of specific protocols to unregister
 * @returns {object} - Status of unregistration
 */
function unregisterDeepLink (protocols = SUPPORTED_PROTOCOLS) {
  const results = {}

  protocols.forEach(protocol => {
    const removed = app.removeAsDefaultProtocolClient(protocol)
    results[protocol] = removed
    if (removed) {
      log.info(`Unregistered as handler for ${protocol}:// protocol`)
    } else {
      log.warn(`Failed to unregister ${protocol}:// protocol handler`)
    }
  })

  return results
}

/**
 * Handle deep link URL by opening a new tab
 * @param {string} url - The protocol URL
 */
function handleDeepLink (url) {
  const parsed = parseQuickConnect(url)

  if (!parsed) {
    log.warn('Could not parse deep link URL:', url)
    return
  }

  const win = globalState.get('win')

  if (win) {
    // If window exists, send message to open new tab
    if (win.isMinimized()) {
      win.restore()
    }
    win.focus()
    win.webContents.send('open-tab', parsed)
  } else {
    // Store the URL to open when window is ready
    globalState.set('pendingDeepLink', parsed)
  }
}

/**
 * Check if there's a pending deep link to open
 * @returns {object|null} - Pending deep link in the same format as initCommandLine or null
 */
function getPendingDeepLink () {
  const pending = globalState.get('pendingDeepLink')
  if (pending) {
    globalState.set('pendingDeepLink', null)
    return pending
  }
  return null
}

/**
 * Setup deep link handlers for the app
 */
function setupDeepLinkHandlers () {
  // Handle deep links on macOS (open-url event)
  if (isMac) {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      log.info('open-url event:', url)
      handleDeepLink(url)
    })
  }

  // Handle deep links via second-instance (when app is already running)
  // (already handled in create-app.js, but we can add additional parsing here)
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    log.info('second-instance event:', commandLine)

    // Look for protocol URLs in command line arguments
    const protocolUrl = commandLine.find(arg =>
      /^(ssh|telnet|rdp|vnc|serial|spice):\/\//i.test(arg)
    )

    if (protocolUrl) {
      handleDeepLink(protocolUrl)
    }
  })

  // Handle protocol URLs passed as command line arguments at startup (all platforms)
  // Note: macOS also fires 'open-url' event when using `open` command or clicking links,
  // but when running `electerm ssh://...` directly in terminal, it comes through argv
  if (process.argv.length >= 2) {
    const protocolUrl = process.argv.find(arg =>
      /^(ssh|telnet|rdp|vnc|serial|spice):\/\//i.test(arg)
    )

    if (protocolUrl) {
      log.info('Startup with protocol URL:', protocolUrl)
      // Store it to be handled after window is ready
      globalState.set('pendingDeepLink', parseQuickConnect(protocolUrl))
    }
  }
}

module.exports = {
  registerDeepLink,
  unregisterDeepLink,
  checkProtocolRegistration,
  handleDeepLink,
  getPendingDeepLink,
  setupDeepLinkHandlers
}
