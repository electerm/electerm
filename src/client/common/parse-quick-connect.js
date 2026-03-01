/**
 * Quick Connect String Parser
 * Parses connection strings according to temp/quick-connect.wiki.md specification
 *
 * Supported Protocols: ssh, telnet, vnc, rdp, spice, serial, ftp, http, https, electerm
 *
 * Basic Format:
 * protocol://[username:password@]host[:port]?anyQueryParam=anyValue&opts={"key":"value"}
 *
 * electerm:// Format (default type is ssh):
 * electerm://[username:password@]host[:port]?type=ssh&anyQueryParam=anyValue
 * electerm://host?type=telnet
 * electerm://user@host:22?type=vnc
 *
 * Shortcut Format (SSH default):
 * user@host
 * user@host:22
 * 192.168.1.100
 * 192.168.1.100:22
 */

const SUPPORTED_PROTOCOLS = ['ssh', 'telnet', 'vnc', 'rdp', 'spice', 'serial', 'ftp', 'http', 'https', 'electerm']

/**
 * Default ports for each protocol
 */
const DEFAULT_PORTS = {
  ssh: 22,
  telnet: 23,
  vnc: 5900,
  rdp: 3389,
  spice: 5900,
  serial: undefined, // Serial doesn't have a default port
  ftp: 21,
  http: 80,
  https: 443,
  electerm: 22 // electerm defaults to SSH port
}

/**
 * Default values for each protocol type
 * Based on src/client/components/bookmark-form/config
 */
const TYPE_DEFAULT_VALUES = {
  ssh: {
    port: 22,
    enableSsh: true,
    enableSftp: true,
    useSshAgent: true,
    term: 'xterm-256color',
    encode: 'utf-8',
    envLang: 'en_US.UTF-8'
  },
  telnet: {
    port: 23
  },
  vnc: {
    port: 5900,
    viewOnly: false,
    clipViewport: false,
    scaleViewport: true,
    qualityLevel: 3,
    compressionLevel: 1,
    shared: true
  },
  rdp: {
    port: 3389
  },
  spice: {
    port: 5900,
    viewOnly: false,
    scaleViewport: true
  },
  serial: {
    baudRate: 9600,
    dataBits: 8,
    lock: true,
    stopBits: 1,
    parity: 'none',
    rtscts: false,
    xon: false,
    xoff: false,
    xany: false,
    term: 'xterm-256color',
    displayRaw: false
  },
  ftp: {
    port: 21,
    encode: 'utf-8',
    secure: false
  },
  web: {},
  local: {}
}

/**
 * Parse a quick connect string into connection options
 * @param {string} str - The connection string
 * @returns {object|null} - Parsed options or null if invalid
 */
function parseQuickConnect (str) {
  if (!str || typeof str !== 'string') {
    return null
  }

  const trimmed = str.trim()
  if (!trimmed) {
    return null
  }

  try {
    // Detect protocol
    const protocolMatch = trimmed.match(/^(ssh|telnet|vnc|rdp|spice|serial|ftp|https?|electerm):\/\//i)

    let protocol = ''
    let connectionString = ''
    let originalProtocol = 'ssh'

    if (protocolMatch) {
      originalProtocol = protocolMatch[1].toLowerCase()
      protocol = originalProtocol
      // Normalize http/https to web
      if (protocol === 'http' || protocol === 'https') {
        protocol = 'web'
      }
      connectionString = trimmed.slice(protocolMatch[0].length)
    } else {
      // Shortcut format - default to SSH
      // Match user@host or user@host:port or just host or host:port
      // Use last colon to determine port for host:port format
      if (/^[\w.-]+@[\w.-]+/.test(trimmed)) {
        // user@host or user@host:port
        protocol = 'ssh'
        connectionString = trimmed
      } else if (/^[\w.-]+:.*:[\d]+$/.test(trimmed)) {
        // host:port format with colons in hostname (e.g., localhost:23344, zxd:localhost:23344)
        // Check if the last colon is followed by digits (port number)
        protocol = 'ssh'
        connectionString = trimmed
      } else if (/^[\w.-]+:[\d]+$/.test(trimmed)) {
        // host:port (no username, simple format like host:22)
        protocol = 'ssh'
        connectionString = trimmed
      } else if (/^[\w.-]+$/.test(trimmed)) {
        // just host
        protocol = 'ssh'
        connectionString = trimmed
      } else {
        return null
      }
    }

    if (!SUPPORTED_PROTOCOLS.includes(protocol) && protocol !== 'web') {
      return null
    }

    // Extract opts from the connection string before parsing
    let optsStr = ''
    const optsMatch = connectionString.match(/[?&]opts=('|")(.+?)('|")$/)
    if (!optsMatch) {
      // Try without quotes
      const optsMatchNoQuote = connectionString.match(/[?&]opts=(\{.+?\})$/)
      if (optsMatchNoQuote) {
        optsStr = optsMatchNoQuote[1]
        connectionString = connectionString.slice(0, optsMatchNoQuote.index)
      }
    } else {
      optsStr = optsMatch[2]
      connectionString = connectionString.slice(0, optsMatch.index)
    }

    // Extract query string for web type and electerm type
    let queryStr = ''
    const queryMatch = connectionString.match(/\?(.+)$/)
    if (queryMatch) {
      queryStr = queryMatch[1]
      connectionString = connectionString.slice(0, queryMatch.index)
    }

    // Parse username:password@host:port
    // First, check if there's an @ for auth
    let username = ''
    let password = ''
    let hostOrPath = ''
    let port = ''

    const atIndex = connectionString.indexOf('@')
    if (atIndex !== -1) {
      // Has auth
      const authPart = connectionString.slice(0, atIndex)
      const hostPart = connectionString.slice(atIndex + 1)
      const colonIndex = authPart.indexOf(':')
      if (colonIndex !== -1) {
        username = authPart.slice(0, colonIndex)
        password = authPart.slice(colonIndex + 1)
      } else {
        username = authPart
      }
      // Parse host:port from hostPart
      const hostColonIndex = hostPart.lastIndexOf(':')
      if (hostColonIndex !== -1) {
        hostOrPath = hostPart.slice(0, hostColonIndex)
        port = hostPart.slice(hostColonIndex + 1)
      } else {
        hostOrPath = hostPart
      }
    } else {
      // No @ sign - check for special case: protocol://password:host (e.g., spice://password:host)
      // This only applies to spice protocol
      if (protocol === 'spice') {
        // Count colons in the connection string
        const colonCount = (connectionString.match(/:/g) || []).length

        if (colonCount >= 2) {
          // Multiple colons - could be password:host:port or host:port with IP
          // Use lastIndexOf for port, then check if first part is password or IP
          const lastColonIndex = connectionString.lastIndexOf(':')
          const portCandidate = connectionString.slice(lastColonIndex + 1)

          if (/^\d+$/.test(portCandidate)) {
            // Last part is a port number
            const hostPortPart = connectionString.slice(0, lastColonIndex)
            const secondLastColonIndex = hostPortPart.lastIndexOf(':')

            if (secondLastColonIndex !== -1) {
              // There's another colon - first part could be password
              const potentialPassword = hostPortPart.slice(0, secondLastColonIndex)
              const hostPart = hostPortPart.slice(secondLastColonIndex + 1)

              // Check if potentialPassword is NOT an IP/hostname
              // An IP/hostname should contain dots, a password typically doesn't
              // Also check it's not a simple number (port)
              const isIPorHostname = (potentialPassword.includes('.') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(potentialPassword))

              if (isIPorHostname) {
                // It's IP, no password
                hostOrPath = hostPortPart
                port = portCandidate
              } else {
                // It's password
                password = potentialPassword
                hostOrPath = hostPart
                port = portCandidate
              }
            } else {
              // Only one colon before the port - it's host:port
              hostOrPath = hostPortPart
              port = portCandidate
            }
          } else {
            // Last part is not a port
            hostOrPath = connectionString
          }
        } else if (colonCount === 1) {
          // Single colon - could be host:port or just a word with colon
          const colonIndex = connectionString.indexOf(':')
          const firstPart = connectionString.slice(0, colonIndex)
          const secondPart = connectionString.slice(colonIndex + 1)

          // Check if first part is an IP
          const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(firstPart)

          if (isIP) {
            // IP with port
            hostOrPath = firstPart
            port = secondPart
          } else if (/^\d+$/.test(secondPart)) {
            // Just a word with port number
            // This is likely password (for spice) or host without port
            // For spice, treat first part as host (not password) since there's only one colon
            hostOrPath = firstPart
            port = secondPart
          } else {
            // host or hostname
            hostOrPath = connectionString
          }
        } else {
          // No colon - just host
          hostOrPath = connectionString
        }
      } else {
        // Normal case - just host:port
        const hostColonIndex = connectionString.lastIndexOf(':')
        if (hostColonIndex !== -1) {
          // Make sure it's a port number (all digits)
          const potentialPort = connectionString.slice(hostColonIndex + 1)
          if (/^\d+$/.test(potentialPort)) {
            hostOrPath = connectionString.slice(0, hostColonIndex)
            port = potentialPort
          } else {
            hostOrPath = connectionString
          }
        } else {
          hostOrPath = connectionString
        }
      }
    }

    if (!hostOrPath) {
      return null
    }

    // Build base options
    // For electerm protocol, we need to handle the type from query params
    let finalProtocol = protocol
    let webProtocol = originalProtocol // Store original for web type

    // Handle electerm:// protocol - extract type from query params, default to ssh
    if (originalProtocol === 'electerm') {
      // Parse query params to get type
      const params = new URLSearchParams(queryStr)
      finalProtocol = params.get('type') || params.get('tp') || 'ssh'

      // Validate the type is supported
      if (!SUPPORTED_PROTOCOLS.includes(finalProtocol) && finalProtocol !== 'web') {
        return null
      }

      // Normalize http/https to web
      if (finalProtocol === 'http' || finalProtocol === 'https') {
        webProtocol = finalProtocol // Store the http/https before normalizing
        finalProtocol = 'web'
        // Remove type/tp from query string for web URL construction
        params.delete('type')
        params.delete('tp')
        queryStr = params.toString()
      }
    } else {
      webProtocol = originalProtocol
    }

    const opts = {
      type: finalProtocol
    }

    // Handle different protocol types
    if (finalProtocol === 'serial') {
      // Serial: path is the port
      opts.path = hostOrPath
      if (port) {
        opts.baudRate = parseInt(port, 10)
      }
      // Parse query params for serial (like baudRate)
      if (queryStr) {
        const params = new URLSearchParams(queryStr)
        if (params.has('baudRate')) {
          opts.baudRate = parseInt(params.get('baudRate'), 10)
        }
      }
    } else if (finalProtocol === 'web') {
      // Web: construct URL from protocol + host + port + query
      let url = `${webProtocol}://${hostOrPath}`
      if (port) {
        // Add non-standard port to URL
        const defaultPort = originalProtocol === 'https' ? 443 : 80
        if (parseInt(port, 10) !== defaultPort) {
          url += `:${port}`
        }
      }
      // Add query string if present
      if (queryStr) {
        const separator = url.includes('?') ? '&' : '?'
        url += `${separator}${queryStr}`
      }
      opts.url = url
    } else {
      // SSH, Telnet, VNC, RDP, Spice, FTP
      opts.host = hostOrPath
      if (port) {
        opts.port = parseInt(port, 10)
      }
      if (username !== undefined && username !== '') {
        opts.username = username
      }
      if (password !== undefined && password !== '') {
        opts.password = password
      }
      // Parse query params for other protocols (like title)
      if (queryStr) {
        const params = new URLSearchParams(queryStr)
        if (params.has('title')) {
          opts.title = params.get('title')
        }
      }
    }

    // Parse opts JSON to extend params
    if (optsStr) {
      try {
        const extraOpts = JSON.parse(optsStr)
        Object.assign(opts, extraOpts)
      } catch (err) {
        console.error('Failed to parse opts:', err)
      }
    }

    // Apply default values for the protocol type
    const typeDefaults = TYPE_DEFAULT_VALUES[finalProtocol]
    if (typeDefaults) {
      Object.keys(typeDefaults).forEach(key => {
        // Only apply default if not already set
        if (opts[key] === undefined) {
          opts[key] = typeDefaults[key]
        }
      })
    }

    return opts
  } catch (error) {
    console.error('Error parsing quick connect string:', error)
    return null
  }
}

/**
 * Get default port for a protocol
 * @param {string} protocol - The protocol name
 * @returns {number|undefined} - Default port or undefined
 */
function getDefaultPort (protocol) {
  return DEFAULT_PORTS[protocol]
}

/**
 * Get list of supported protocols
 * @returns {string[]} - List of supported protocols
 */
function getSupportedProtocols () {
  return [...SUPPORTED_PROTOCOLS]
}

export {
  parseQuickConnect,
  getDefaultPort,
  getSupportedProtocols,
  SUPPORTED_PROTOCOLS,
  DEFAULT_PORTS
}
