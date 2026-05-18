const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const { dirname, join } = require('path')
const { parseKey } = require('@electerm/ssh2/lib/protocol/keyParser.js')

function normalizeHost (host = '') {
  if (typeof host !== 'string') {
    return ''
  }
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1)
  }
  return host
}

function getKnownHostsPath () {
  return join(os.homedir(), '.ssh', 'known_hosts')
}

function getKnownHostCandidates (host, port) {
  const normalizedHost = normalizeHost(host)
  const normalizedPort = Number(port) || 22
  const candidates = new Set([normalizedHost])
  candidates.add(`[${normalizedHost}]:${normalizedPort}`)
  return [...candidates].filter(Boolean)
}

function escapeRegExp (value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function wildcardToRegExp (value) {
  const pattern = escapeRegExp(value)
    .replace(/\\\*/g, '.*')
    .replace(/\\\?/g, '.')
  return new RegExp(`^${pattern}$`)
}

function matchesHashedHost (entry, candidate) {
  const parts = entry.split('|')
  if (parts.length !== 4 || parts[1] !== '1') {
    return false
  }
  try {
    const salt = Buffer.from(parts[2], 'base64')
    const hash = Buffer.from(parts[3], 'base64')
    const digest = crypto
      .createHmac('sha1', salt)
      .update(candidate)
      .digest()
    return digest.equals(hash)
  } catch {
    return false
  }
}

function matchesHostToken (token, candidates) {
  if (!token) {
    return false
  }
  if (token.startsWith('|1|')) {
    return candidates.some(candidate => matchesHashedHost(token, candidate))
  }
  const matcher = token.includes('*') || token.includes('?')
    ? wildcardToRegExp(token)
    : null
  return candidates.some(candidate => {
    if (matcher) {
      return matcher.test(candidate)
    }
    return token === candidate
  })
}

function matchesKnownHostField (hostField, host, port) {
  const candidates = getKnownHostCandidates(host, port)
  const tokens = hostField.split(',').map(token => token.trim()).filter(Boolean)
  let matched = false
  for (const token of tokens) {
    const isNegative = token.startsWith('!')
    const cleanToken = isNegative ? token.slice(1) : token
    if (!matchesHostToken(cleanToken, candidates)) {
      continue
    }
    if (isNegative) {
      return false
    }
    matched = true
  }
  return matched
}

function parseKnownHostsLine (line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length < 3) {
    return null
  }
  let marker
  if (parts[0].startsWith('@')) {
    if (parts.length < 4) {
      return null
    }
    marker = parts.shift()
  }
  const [hosts, keyType, keyData] = parts
  if (!hosts || !keyType || !keyData) {
    return null
  }
  return {
    marker,
    hosts,
    keyType,
    keyData
  }
}

function getHostKeyMeta (hostKey) {
  const parsed = parseKey(hostKey)
  if (parsed instanceof Error) {
    throw parsed
  }
  return {
    keyType: parsed.type,
    keyData: parsed.getPublicSSH().toString('base64'),
    sha256: crypto.createHash('sha256').update(hostKey).digest('base64')
  }
}

function formatSha256Fingerprint (sha256) {
  return `SHA256:${sha256}`
}

async function readKnownHostsFile (knownHostsPath = getKnownHostsPath()) {
  try {
    return await fs.promises.readFile(knownHostsPath, 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return ''
    }
    throw err
  }
}

async function checkKnownHosts (options) {
  const {
    host,
    port,
    hostKey,
    knownHostsPath = getKnownHostsPath()
  } = options
  const knownHosts = await readKnownHostsFile(knownHostsPath)
  const meta = getHostKeyMeta(hostKey)
  const lines = knownHosts.split(/\r?\n/)
  const matchingEntries = []
  for (const line of lines) {
    const entry = parseKnownHostsLine(line)
    if (!entry) {
      continue
    }
    if (!matchesKnownHostField(entry.hosts, host, port)) {
      continue
    }
    matchingEntries.push(entry)
  }
  const sameTypeEntries = matchingEntries.filter(entry => entry.keyType === meta.keyType)
  const exactMatch = sameTypeEntries.find(entry => entry.keyData === meta.keyData)
  if (exactMatch) {
    if (exactMatch.marker === '@revoked') {
      return {
        status: 'revoked',
        meta,
        knownHostsPath
      }
    }
    return {
      status: 'match',
      meta,
      knownHostsPath
    }
  }
  if (sameTypeEntries.length) {
    return {
      status: 'mismatch',
      meta,
      knownHostsPath,
      entries: sameTypeEntries
    }
  }
  return {
    status: 'not-found',
    meta,
    knownHostsPath,
    entries: matchingEntries
  }
}

async function appendKnownHost (options) {
  const {
    host,
    port,
    hostKey,
    knownHostsPath = getKnownHostsPath()
  } = options
  const meta = getHostKeyMeta(hostKey)
  await fs.promises.mkdir(dirname(knownHostsPath), {
    recursive: true,
    mode: 0o700
  })
  const hostToken = Number(port) && Number(port) !== 22
    ? `[${normalizeHost(host)}]:${Number(port)}`
    : normalizeHost(host)
  const prefix = await readKnownHostsFile(knownHostsPath)
  const needsNewline = prefix && !prefix.endsWith('\n')
  const line = `${hostToken} ${meta.keyType} ${meta.keyData}\n`
  await fs.promises.appendFile(knownHostsPath, `${needsNewline ? '\n' : ''}${line}`, {
    mode: 0o600
  })
  return meta
}

function buildUnknownHostPrompt (options) {
  const {
    host,
    port,
    meta,
    knownHostsPath = getKnownHostsPath()
  } = options
  const target = Number(port) && Number(port) !== 22
    ? `[${normalizeHost(host)}]:${Number(port)}`
    : normalizeHost(host)
  return {
    mode: 'confirm',
    name: `Trust SSH host key for ${target}?`,
    instructions: [
      `The authenticity of host '${target}' can't be established.`,
      `Key type: ${meta.keyType}`,
      `Fingerprint: ${formatSha256Fingerprint(meta.sha256)}`,
      `Known hosts file: ${knownHostsPath}`,
      'Trust this host key and add it to known_hosts?'
    ],
    prompts: [],
    submitText: 'Trust and Save',
    cancelText: 'Reject',
    confirmResult: 'trust'
  }
}

function buildHostMismatchError (options) {
  const {
    host,
    port,
    meta,
    knownHostsPath = getKnownHostsPath()
  } = options
  const target = Number(port) && Number(port) !== 22
    ? `[${normalizeHost(host)}]:${Number(port)}`
    : normalizeHost(host)
  return new Error(
    [
      `SSH host key verification failed for ${target}.`,
      `Presented ${meta.keyType} fingerprint ${formatSha256Fingerprint(meta.sha256)} does not match ${knownHostsPath}.`,
      'Remove the old known_hosts entry if you trust the new host key.'
    ].join(' ')
  )
}

function createHostVerifier (options) {
  const {
    host,
    port,
    knownHostsPath = getKnownHostsPath(),
    confirm,
    onError
  } = options
  return (hostKey, verify) => {
    checkKnownHosts({
      host,
      port,
      hostKey,
      knownHostsPath
    })
      .then(async (result) => {
        if (result.status === 'match') {
          verify(true)
          return
        }
        if (result.status === 'mismatch' || result.status === 'revoked') {
          onError && onError(buildHostMismatchError({
            host,
            port,
            meta: result.meta,
            knownHostsPath
          }))
          verify(false)
          return
        }
        const accepted = await confirm(buildUnknownHostPrompt({
          host,
          port,
          meta: result.meta,
          knownHostsPath
        }))
        if (!accepted) {
          onError && onError(new Error('SSH host key verification was canceled by the user.'))
          verify(false)
          return
        }
        await appendKnownHost({
          host,
          port,
          hostKey,
          knownHostsPath
        })
        verify(true)
      })
      .catch((err) => {
        onError && onError(err)
        verify(false)
      })
  }
}

module.exports = {
  appendKnownHost,
  buildHostMismatchError,
  buildUnknownHostPrompt,
  checkKnownHosts,
  createHostVerifier,
  formatSha256Fingerprint,
  getHostKeyMeta,
  getKnownHostCandidates,
  getKnownHostsPath,
  matchesHashedHost,
  matchesKnownHostField,
  normalizeHost,
  parseKnownHostsLine
}
