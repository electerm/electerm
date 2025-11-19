/**
 * Deep link support for electerm
 * Handles protocol URLs like ssh://, telnet://, rdp://, vnc://, etc.
 */

const { app } = require('electron')
const log = require('../common/log')
const globalState = require('./glob-state')

/**
 * Parse a protocol URL and convert it to electerm options
 * @param {string} url - The protocol URL (e.g., telnet://192.168.2.31:34554)
 * @returns {object|null} - Parsed options or null if invalid
 */
function parseProtocolUrl (url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    // Handle URLs passed as array (from command line)
    if (Array.isArray(url)) {
      url = url.find(u => typeof u === 'string' && u.includes('://'))
    }

    log.info('Parsing deep link URL:', url)

    // Parse the URL
    const urlObj = new URL(url)
    const protocol = urlObj.protocol.replace(':', '').toLowerCase()

    // Supported protocols
    const supportedProtocols = ['ssh', 'telnet', 'rdp', 'vnc', 'serial']

    if (!supportedProtocols.includes(protocol)) {
      log.warn('Unsupported protocol:', protocol)
      return null
    }

    // Base options
    const options = {
      tp: protocol,
      fromCmdLine: true
    }

    // Parse based on protocol type
    if (protocol === 'serial') {
      // serial://COM1?baudRate=115200&dataBits=8&stopBits=1&parity=none
      options.opts = JSON.stringify({
        port: urlObj.hostname || urlObj.pathname.replace('/', ''),
        baudRate: parseInt(urlObj.searchParams.get('baudRate') || '115200'),
        dataBits: parseInt(urlObj.searchParams.get('dataBits') || '8'),
        stopBits: parseInt(urlObj.searchParams.get('stopBits') || '1'),
        parity: urlObj.searchParams.get('parity') || 'none'
      })
    } else {
      // For ssh, telnet, rdp, vnc: protocol://[user[:password]@]host[:port][?params]
      const host = urlObj.hostname
      const port = urlObj.port || getDefaultPort(protocol)
      const username = urlObj.username || undefined
      const password = urlObj.password || undefined

      // Get additional parameters from query string
      const title = urlObj.searchParams.get('title') || urlObj.searchParams.get('name')
      const privateKeyPath = urlObj.searchParams.get('privateKey') || urlObj.searchParams.get('key')

      options.opts = JSON.stringify({
        host,
        port: parseInt(port),
        ...(username && { username }),
        ...(password && { password }),
        ...(title && { title }),
        ...(privateKeyPath && { privateKeyPath })
      })

      // Handle title separately if provided
      if (title) {
        options.title = title
      }
    }

    log.info('Parsed deep link options:', options)
    return options
  } catch (error) {
    log.error('Error parsing protocol URL:', error)
    return null
  }
}

/**
 * Get default port for a protocol
 * @param {string} protocol
 * @returns {number}
 */
function getDefaultPort (protocol) {
  const defaultPorts = {
    ssh: 22,
    telnet: 23,
    rdp: 3389,
    vnc: 5900
  }
  return defaultPorts[protocol] || 22
}

/**
 * Register electerm as a handler for supported protocols
 * Note: This makes electerm available as a handler but doesn't force it as default.
 * Users can still choose their preferred app in system settings.
 *
 * @param {boolean} force - If true, register even if not packaged (for testing)
 * @returns {object} - Status of registration for each protocol
 */
function registerDeepLink (force = false) {
  const protocols = ['ssh', 'telnet', 'rdp', 'vnc', 'serial']
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
  const protocols = ['ssh', 'telnet', 'rdp', 'vnc', 'serial']
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
function unregisterDeepLink (protocols = ['ssh', 'telnet', 'rdp', 'vnc', 'serial']) {
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
  const options = parseProtocolUrl(url)

  if (!options) {
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
    win.webContents.send('add-tab-from-command-line', { options })
  } else {
    // Store the URL to open when window is ready
    globalState.set('pendingDeepLink', options)
  }
}

/**
 * Check if there's a pending deep link to open
 * @returns {object|null} - Pending options or null
 */
function getPendingDeepLink () {
  const pending = globalState.get('pendingDeepLink')
  if (pending) {
    globalState.set('pendingDeepLink', null)
    return { options: pending }
  }
  return null
}

/**
 * Setup deep link handlers for the app
 */
function setupDeepLinkHandlers () {
  // Handle deep links on macOS (open-url event)
  app.on('open-url', (event, url) => {
    event.preventDefault()
    log.info('open-url event:', url)
    handleDeepLink(url)
  })

  // Handle deep links on Windows/Linux via second-instance
  // (already handled in create-app.js, but we can add additional parsing here)
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    log.info('second-instance event:', commandLine)

    // Look for protocol URLs in command line arguments
    const protocolUrl = commandLine.find(arg =>
      /^(ssh|telnet|rdp|vnc|serial):\/\//i.test(arg)
    )

    if (protocolUrl) {
      handleDeepLink(protocolUrl)
    }
  })

  // On Windows, handle protocol URLs passed as command line arguments at startup
  if (process.platform === 'win32' && process.argv.length >= 2) {
    const protocolUrl = process.argv.find(arg =>
      /^(ssh|telnet|rdp|vnc|serial):\/\//i.test(arg)
    )

    if (protocolUrl) {
      log.info('Startup with protocol URL:', protocolUrl)
      // Store it to be handled after window is ready
      globalState.set('pendingDeepLink', parseProtocolUrl(protocolUrl))
    }
  }
}

module.exports = {
  registerDeepLink,
  unregisterDeepLink,
  checkProtocolRegistration,
  parseProtocolUrl,
  handleDeepLink,
  getPendingDeepLink,
  setupDeepLinkHandlers
}
