import bookmarkSchema from './bookmark-schema.js'

const defaultValues = {
  ssh: {
    port: 22,
    enableSsh: true,
    enableSftp: true,
    useSshAgent: true,
    x11: false,
    term: 'xterm-256color',
    displayRaw: false,
    encode: 'utf8',
    envLang: 'en_US.UTF-8'
  },
  telnet: {
    port: 23
  },
  serial: {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    rtscts: false,
    xon: false,
    xoff: false,
    xany: false
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
  ftp: {
    port: 21,
    secure: false
  }
}

const requiredFields = {
  ssh: ['host', 'username', 'term'],
  telnet: ['host'],
  serial: ['path'],
  vnc: ['host'],
  rdp: ['host'],
  ftp: ['host'],
  web: ['url']
}

export function fixBookmarkData (data) {
  if (!data || typeof data !== 'object') {
    return data
  }

  const type = data.type || 'ssh'
  const schema = bookmarkSchema[type]

  if (!schema) {
    return data
  }

  const fixed = { ...data }

  if (!fixed.type) {
    fixed.type = type
  }

  const defaults = defaultValues[type] || {}
  for (const [key, value] of Object.entries(defaults)) {
    if (fixed[key] === undefined || fixed[key] === null) {
      fixed[key] = value
    }
  }

  if (fixed.connectionHoppings?.length) {
    fixed.hasHopping = true
  }

  return fixed
}

export function validateBookmarkData (data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Invalid data format']
    }
  }

  const type = data.type || 'ssh'
  const required = requiredFields[type] || []
  const errors = []

  for (const field of required) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function getMissingRequiredFields (data) {
  if (!data || typeof data !== 'object') {
    return []
  }

  const type = data.type || 'ssh'
  const required = requiredFields[type] || []
  const missing = []

  for (const field of required) {
    if (!data[field]) {
      missing.push(field)
    }
  }

  return missing
}

export default {
  fixBookmarkData,
  validateBookmarkData,
  getMissingRequiredFields
}
