/**
 * Pure data, parsing and presentation helpers for the remote monitor bar.
 * This module has no transport or UI dependencies.
 */

const ITEM_IDS = [
  'hostname',
  'cpu',
  'cpuHistory',
  'memory',
  'upload',
  'download',
  'uptime',
  'users',
  'disks'
]

export const REMOTE_MONITOR_ITEM_IDS = Object.freeze([...ITEM_IDS])

export const DEFAULT_REMOTE_MONITOR_ITEMS = Object.freeze(
  ITEM_IDS.map(id => Object.freeze({ id, enabled: true }))
)

const KNOWN_ITEM_IDS = new Set(ITEM_IDS)

function cloneDefaultItems () {
  return DEFAULT_REMOTE_MONITOR_ITEMS.map(item => ({ ...item }))
}

export function normalizeRemoteMonitorItems (value) {
  if (!Array.isArray(value)) {
    return cloneDefaultItems()
  }
  const result = []
  const seen = new Set()
  for (const entry of value) {
    const id = typeof entry === 'string' ? entry : entry && entry.id
    if (!KNOWN_ITEM_IDS.has(id) || seen.has(id)) {
      continue
    }
    const enabled = entry && typeof entry === 'object' && typeof entry.enabled === 'boolean'
      ? entry.enabled
      : true
    result.push({ id, enabled })
    seen.add(id)
  }
  for (const id of ITEM_IDS) {
    if (!seen.has(id)) {
      result.push({ id, enabled: false })
    }
  }
  return result
}

const NETWORK_COMMAND = [
  '{',
  '[ -d /sys/class/net ] || exit 127;',
  "default_if=$(ip route show default 2>/dev/null | awk 'NR==1 {print $5}');",
  "printf 'default\\t%s\\n' \"$default_if\";",
  'for d in /sys/class/net/*; do',
  '[ -d "$d" ] || continue;',
  'n=$' + '{d##*/};',
  '[ "$n" = lo ] && continue;',
  'state=$(cat "$d/operstate" 2>/dev/null || true);',
  "ipv4=$(ip -o -4 addr show dev \"$n\" 2>/dev/null | awk 'NR==1 {print $4}');",
  'rx=$(cat "$d/statistics/rx_bytes" 2>/dev/null || true);',
  'tx=$(cat "$d/statistics/tx_bytes" 2>/dev/null || true);',
  "printf 'iface\\t%s\\tstate=%s\\tipv4=%s\\trx=%s\\ttx=%s\\n' \"$n\" \"$state\" \"$ipv4\" \"$rx\" \"$tx\";",
  'done;',
  '}'
].join(' ')

export const REMOTE_MONITOR_COMMANDS = Object.freeze({
  sysinfo: Object.freeze([
    'uname -s -n -r -m',
    'grep PRETTY_NAME= /etc/os-release 2>/dev/null || echo'
  ]),
  cpu: "grep '^cpu ' /proc/stat; sleep 0.1; grep '^cpu ' /proc/stat",
  memory: 'cat /proc/meminfo',
  network: NETWORK_COMMAND,
  uptime: 'cat /proc/uptime',
  users: 'who',
  disks: 'df -Pk',
  activities: 'ps -eo pid=,user=,pcpu=,rss=,args= --sort=-pcpu'
})

export const REMOTE_MONITOR_INTERVALS = Object.freeze({
  sysinfo: 0,
  cpu: 5000,
  memory: 5000,
  network: 5000,
  uptime: 5000,
  users: 30000,
  disks: 10000,
  activities: 5000
})

export const REMOTE_MONITOR_COMMAND_DEFINITIONS = Object.freeze(
  Object.fromEntries(Object.keys(REMOTE_MONITOR_COMMANDS).map(name => [
    name,
    Object.freeze({
      command: REMOTE_MONITOR_COMMANDS[name],
      interval: REMOTE_MONITOR_INTERVALS[name]
    })
  ]))
)

function commandResult (input) {
  if (typeof input === 'string') {
    return { text: input, ok: true }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { text: '', ok: false }
  }
  const text = typeof input.stdout === 'string'
    ? input.stdout
    : typeof input.output === 'string'
      ? input.output
      : typeof input.text === 'string'
        ? input.text
        : ''
  const hasFailure = input.timedOut === true || Boolean(input.error) || (
    input.exitCode !== undefined && input.exitCode !== null && Number(input.exitCode) !== 0
  )
  const hasText = typeof input.stdout === 'string' || typeof input.output === 'string' || typeof input.text === 'string'
  return { text, ok: !hasFailure && hasText }
}

function numeric (value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null
  }
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function nonNegativeNumber (value) {
  const number = numeric(value)
  return number !== null && number >= 0 ? number : null
}

function parseCounter (value) {
  const number = nonNegativeNumber(value)
  return number !== null && Number.isInteger(number) ? number : null
}

function parseCpuLine (line) {
  const fields = String(line).trim().split(/\s+/)
  if (fields.length < 3 || fields[0] !== 'cpu') {
    return null
  }
  const values = fields.slice(1, 9).map(parseCounter)
  return values.every(value => value !== null) ? values : null
}

function usageFromCpuSamples (first, second) {
  if (!first || !second || first.length < 4 || second.length !== first.length) {
    return null
  }
  const deltas = second.map((value, index) => value - first[index])
  if (deltas.some(value => value < 0)) {
    return null
  }
  const totalDelta = deltas.reduce((sum, value) => sum + value, 0)
  if (totalDelta <= 0) {
    return null
  }
  const idleDelta = (deltas[3] || 0) + (deltas[4] || 0)
  const usedDelta = Math.max(0, totalDelta - idleDelta)
  return Math.max(0, Math.min(100, usedDelta * 100 / totalDelta))
}

export function parseCpu (input) {
  const result = commandResult(input)
  if (!result.ok) {
    return null
  }
  const lines = result.text.split(/\r?\n/).filter(line => /^\s*cpu(?:\s|$)/.test(line))
  const samples = lines.map(parseCpuLine).filter(Boolean)
  if (samples.length >= 2) {
    return usageFromCpuSamples(samples[0], samples[1])
  }
  const legacy = result.text.match(/\bCPU\s+([0-9]+(?:\.[0-9]+)?)\s*%?/i)
  if (!legacy) {
    return null
  }
  const value = numeric(legacy[1])
  return value === null ? null : Math.max(0, Math.min(100, value))
}

const MEMORY_UNITS = {
  b: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  tb: 1024 ** 4,
  tib: 1024 ** 4
}

function parseMemoryValue (value, unit) {
  const number = numeric(value)
  if (number === null || number < 0) {
    return null
  }
  const multiplier = unit ? MEMORY_UNITS[String(unit).toLowerCase()] : 1
  return multiplier ? number * multiplier : null
}

export function parseMemory (input) {
  const result = commandResult(input)
  if (!result.ok || !result.text.trim()) {
    return null
  }
  const values = {}
  for (const line of result.text.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?\s*$/)
    if (!match) {
      continue
    }
    const value = parseMemoryValue(match[2], match[3])
    if (value !== null) {
      values[match[1]] = value
    }
  }
  const totalBytes = values.MemTotal
  if (totalBytes === undefined || totalBytes <= 0) {
    return null
  }
  const freeBytes = values.MemFree === undefined ? null : values.MemFree
  const hasAvailable = values.MemAvailable !== undefined
  const rawAvailable = hasAvailable ? values.MemAvailable : freeBytes
  if (rawAvailable === null || rawAvailable === undefined) {
    return null
  }
  const availableBytes = Math.max(0, Math.min(totalBytes, rawAvailable))
  const usedBytes = totalBytes - availableBytes
  const swapTotalBytes = values.SwapTotal === undefined ? null : values.SwapTotal
  const swapFreeBytes = values.SwapFree === undefined ? null : values.SwapFree
  const swapUsedBytes = swapTotalBytes === null || swapFreeBytes === null
    ? null
    : Math.max(0, swapTotalBytes - Math.min(swapTotalBytes, swapFreeBytes))
  return {
    totalBytes,
    availableBytes,
    usedBytes,
    freeBytes,
    swapTotalBytes,
    swapUsedBytes,
    percent: usedBytes * 100 / totalBytes,
    compatibilityMode: !hasAvailable
  }
}

export function parseUptime (input, sampleTimestamp) {
  const result = commandResult(input)
  if (!result.ok || !result.text.trim()) {
    return null
  }
  const match = result.text.trim().match(/^([0-9]+(?:\.[0-9]+)?)(?:\s|$)/)
  if (!match) {
    return null
  }
  const seconds = nonNegativeNumber(match[1])
  if (seconds === null) {
    return null
  }
  const timestamp = numeric(sampleTimestamp !== undefined ? sampleTimestamp : input && input.sampleTimestamp)
  return {
    seconds,
    bootTime: timestamp === null ? null : timestamp - seconds * 1000
  }
}

export function parseSysInfo (unameInput, prettyInput) {
  const uname = commandResult(unameInput)
  if (!uname.ok || !uname.text.trim()) {
    return null
  }
  const fields = uname.text.trim().split(/\s+/)
  if (fields.length < 4) {
    return null
  }
  const [sysname, hostname, kernel, arch] = fields
  const pretty = prettyInput === undefined ? { text: '', ok: true } : commandResult(prettyInput)
  const prettyMatch = pretty.text.match(/(?:^|\n)PRETTY_NAME=([^\r\n]*)/)
  let os = prettyMatch ? prettyMatch[1].trim() : sysname
  if (os.startsWith('"') && os.endsWith('"')) {
    os = os.slice(1, -1)
  }
  if (sysname === 'Darwin' && os === sysname) {
    os = 'macOS'
  }
  return { os, sysname, hostname, kernel, arch }
}

function isLoopback (name) {
  return name === 'lo' || name.startsWith('lo:')
}

function parseInterfaceCounter (value) {
  if (value === undefined || value === '') {
    return null
  }
  return parseCounter(value)
}

function parseNetworkLine (line) {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }
  const fields = trimmed.split(/\s+/)
  if (fields[0].toLowerCase() === 'iface' && fields.length >= 2) {
    const name = fields[1]
    const attributes = fields.slice(2)
    const stateField = attributes.find(field => /^state=/i.test(field))
    const ipv4Field = attributes.find(field => /^ipv4=/i.test(field))
    const rxField = attributes.find(field => /^rx(?:_bytes)?=/i.test(field))
    const txField = attributes.find(field => /^tx(?:_bytes)?=/i.test(field))
    return {
      name,
      ipv4: ipv4Field ? (ipv4Field.slice(ipv4Field.indexOf('=') + 1).split('/')[0] || null) : null,
      state: stateField ? stateField.slice(stateField.indexOf('=') + 1) || null : null,
      rxBytes: rxField ? parseInterfaceCounter(rxField.slice(rxField.indexOf('=') + 1)) : null,
      txBytes: txField ? parseInterfaceCounter(txField.slice(txField.indexOf('=') + 1)) : null
    }
  }
  if (fields.length < 2 || /^(default|route)$/i.test(fields[0])) {
    return null
  }
  const name = fields[0]
  const numericFields = fields.slice(1).filter(field => /^\d+$/.test(field))
  if (numericFields.length < 2) {
    return null
  }
  const state = fields.slice(1).find(field => /^(up|down|unknown|dormant|lowerlayerdown)$/i.test(field)) || null
  const ipv4 = fields.slice(1).find(field => /^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?$/.test(field))
  return {
    name,
    ipv4: ipv4 ? ipv4.split('/')[0] : null,
    state,
    rxBytes: parseInterfaceCounter(numericFields[0]),
    txBytes: parseInterfaceCounter(numericFields[1])
  }
}

export function parseNetwork (input) {
  const result = commandResult(input)
  if (!result.ok || !result.text.trim()) {
    return null
  }
  let defaultInterface = null
  const interfaces = []
  const seen = new Set()
  for (const line of result.text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const defaultMatch = trimmed.match(/^(?:default|route)(?:\s+|=)([^\s]+)/i)
    if (defaultMatch) {
      defaultInterface = defaultMatch[1]
      continue
    }
    const parsed = parseNetworkLine(line)
    if (!parsed || !parsed.name || seen.has(parsed.name)) {
      continue
    }
    interfaces.push(parsed)
    seen.add(parsed.name)
  }
  return interfaces.length || defaultInterface ? { defaultInterface, interfaces } : null
}

function interfaceByName (network, name) {
  return network && Array.isArray(network.interfaces)
    ? network.interfaces.find(item => item.name === name) || null
    : null
}

export function selectPrimaryNetwork (network) {
  if (!network || !Array.isArray(network.interfaces)) {
    return null
  }
  const preferred = interfaceByName(network, network.defaultInterface)
  if (preferred && !isLoopback(preferred.name)) {
    return preferred
  }
  return network.interfaces
    .filter(item => item && item.name && !isLoopback(item.name))
    .slice()
    .sort((a, b) => {
      const aActive = String(a.state || '').toLowerCase() === 'up' ? 1 : 0
      const bActive = String(b.state || '').toLowerCase() === 'up' ? 1 : 0
      const aComplete = Number.isFinite(a.rxBytes) && Number.isFinite(a.txBytes) ? 1 : 0
      const bComplete = Number.isFinite(b.rxBytes) && Number.isFinite(b.txBytes) ? 1 : 0
      return bActive - aActive || bComplete - aComplete || a.name.localeCompare(b.name)
    })[0] || null
}

function networkTimestamp (network, fallback) {
  const value = fallback !== undefined
    ? fallback
    : network && (network.sampleTimestamp !== undefined ? network.sampleTimestamp : network.timestampMs)
  return numeric(value)
}

function cloneNetworkWithRates (network, sampleTimestamp, rates, reset, resetReason, elapsedMs) {
  return {
    defaultInterface: network.defaultInterface || null,
    interfaces: network.interfaces.map(item => ({
      ...item,
      rxRate: rates[item.name] ? rates[item.name].rxRate : null,
      txRate: rates[item.name] ? rates[item.name].txRate : null
    })),
    sampleTimestamp,
    elapsedMs: elapsedMs === undefined ? null : elapsedMs,
    reset: Boolean(reset),
    resetReason: resetReason || null
  }
}

export function deriveNetworkRates (previous, current, sampleTimestamp) {
  if (!current || !Array.isArray(current.interfaces)) {
    return null
  }
  const timestamp = networkTimestamp(current, sampleTimestamp)
  const rates = {}
  const resetAll = reason => cloneNetworkWithRates(current, timestamp, rates, true, reason)
  if (!previous || !Array.isArray(previous.interfaces)) {
    return resetAll('initial-sample')
  }
  const previousTimestamp = networkTimestamp(previous)
  if (timestamp === null || previousTimestamp === null || timestamp <= previousTimestamp) {
    return resetAll('invalid-elapsed-time')
  }
  const previousPrimary = selectPrimaryNetwork(previous)
  const currentPrimary = selectPrimaryNetwork(current)
  if ((previousPrimary && currentPrimary && previousPrimary.name !== currentPrimary.name) ||
      (!previousPrimary && currentPrimary) || (previousPrimary && !currentPrimary)) {
    return resetAll('interface-changed')
  }
  const elapsedMs = timestamp - previousTimestamp
  let hadRollback = false
  for (const item of current.interfaces) {
    const old = interfaceByName(previous, item.name)
    if (!old || item.rxBytes === null || item.txBytes === null || old.rxBytes === null || old.txBytes === null) {
      continue
    }
    const rxDelta = item.rxBytes - old.rxBytes
    const txDelta = item.txBytes - old.txBytes
    if (rxDelta < 0 || txDelta < 0) {
      hadRollback = true
      continue
    }
    rates[item.name] = {
      rxRate: rxDelta * 1000 / elapsedMs,
      txRate: txDelta * 1000 / elapsedMs
    }
  }
  return cloneNetworkWithRates(current, timestamp, rates, hadRollback, hadRollback ? 'counter-rollback' : null, elapsedMs)
}

export function parseUsers (input) {
  const result = commandResult(input)
  if (!result.ok) {
    return null
  }
  const sessions = []
  for (const line of result.text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const fields = trimmed.split(/\s+/)
    if (fields.length < 2) {
      continue
    }
    const sourceMatch = trimmed.match(/\(([^)]*)\)\s*$/)
    const source = sourceMatch ? sourceMatch[1] : null
    const withoutSource = sourceMatch ? trimmed.slice(0, sourceMatch.index).trim() : trimmed
    const parts = withoutSource.split(/\s+/)
    const user = parts[0]
    const terminal = parts[1] || null
    const loginTime = parts.slice(2).join(' ') || null
    sessions.push({ user, terminal, loginTime, source })
  }
  if (result.text.trim() && !sessions.length) {
    return null
  }
  const users = []
  const seen = new Set()
  for (const session of sessions) {
    if (!seen.has(session.user)) {
      users.push(session.user)
      seen.add(session.user)
    }
  }
  return { users, sessions }
}

const PSEUDO_FILESYSTEMS = new Set([
  'autofs', 'bpf', 'cgroup', 'cgroup2', 'configfs', 'debugfs', 'devpts',
  'devtmpfs', 'fusectl', 'hugetlbfs', 'mqueue', 'nsfs', 'pstore', 'proc',
  'ramfs', 'securityfs', 'squashfs', 'sysfs', 'tmpfs'
])

function decodeMount (value) {
  return value
    .replace(/\\040/g, ' ')
    .replace(/\\011/g, '\t')
    .replace(/\\134/g, '\\')
}

function diskFromFields (filesystem, fields) {
  const percentIndex = fields.findIndex(field => /^\d+%$/.test(field))
  if (percentIndex < 3 || percentIndex === fields.length - 1) {
    return null
  }
  const blocks = numeric(fields[percentIndex - 3])
  const usedBlocks = numeric(fields[percentIndex - 2])
  const availableBlocks = numeric(fields[percentIndex - 1])
  const percent = numeric(fields[percentIndex].slice(0, -1))
  const mount = decodeMount(fields.slice(percentIndex + 1).join(' '))
  if ([blocks, usedBlocks, availableBlocks, percent].some(value => value === null) || !mount) {
    return null
  }
  const filesystemName = filesystem || fields.slice(0, percentIndex - 3).join(' ')
  if (!filesystemName) {
    return null
  }
  return {
    filesystem: filesystemName,
    totalBytes: blocks * 1024,
    usedBytes: usedBlocks * 1024,
    availableBytes: availableBlocks * 1024,
    percent,
    mount
  }
}

function isRelevantDisk (disk) {
  const fs = disk.filesystem.toLowerCase()
  if (fs === 'overlay') {
    return disk.mount === '/'
  }
  return !PSEUDO_FILESYSTEMS.has(fs)
}

export function parseDisks (input) {
  const result = commandResult(input)
  if (!result.ok || !result.text.trim()) {
    return null
  }
  const disks = []
  let wrappedFilesystem = null
  let sawHeader = false
  for (const line of result.text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }
    if (/^\s*Filesystem\s+/i.test(line)) {
      sawHeader = true
      continue
    }
    const fields = line.trim().split(/\s+/)
    const percentIndex = fields.findIndex(field => /^\d+%$/.test(field))
    let disk
    if (/^\s/.test(line) && wrappedFilesystem && percentIndex >= 3) {
      disk = diskFromFields(wrappedFilesystem, fields)
      wrappedFilesystem = null
    } else if (percentIndex >= 3) {
      disk = diskFromFields(null, fields)
    } else if (fields.length === 1) {
      wrappedFilesystem = fields[0]
    }
    if (disk && isRelevantDisk(disk)) {
      disks.push(disk)
    }
  }
  return sawHeader || disks.length ? disks : null
}

export function parseActivities (input) {
  const result = commandResult(input)
  if (!result.ok || !result.text.trim()) {
    return null
  }
  const activities = []
  let sawHeader = false
  for (const line of result.text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    if (/^pid\s+/i.test(trimmed)) {
      sawHeader = true
      continue
    }
    const fields = trimmed.split(/\s+/)
    if (fields.length < 4 || !/^\d+$/.test(fields[0])) {
      continue
    }
    const cpu = numeric(fields[2])
    const rssKb = numeric(fields[3])
    if (cpu === null || rssKb === null || rssKb < 0) {
      continue
    }
    activities.push({
      pid: Number(fields[0]),
      user: fields[1],
      cpu,
      memBytes: rssKb * 1024,
      cmd: fields.slice(4).join(' ')
    })
  }
  if (!activities.length && !sawHeader) {
    return null
  }
  return activities.sort((a, b) => b.cpu - a.cpu || a.pid - b.pid)
}

export function getUsageLevel (value, previous = 'normal') {
  const number = numeric(value)
  if (number === null || number < 0) {
    return 'unknown'
  }
  const level = previous === 'critical' || previous === 'warning' || previous === 'normal'
    ? previous
    : 'normal'
  if (level === 'critical') {
    if (number >= 85) return 'critical'
    if (number >= 80) return 'warning'
    return 'normal'
  }
  if (level === 'warning') {
    if (number >= 90) return 'critical'
    if (number >= 75) return 'warning'
    return 'normal'
  }
  if (number >= 90) return 'critical'
  if (number >= 80) return 'warning'
  return 'normal'
}

function compactNumber (value, decimals) {
  const rounded = Number(value.toFixed(decimals))
  return String(rounded)
}

export function formatBytes (value) {
  const bytes = numeric(value)
  if (bytes === null || bytes < 0) {
    return '—'
  }
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let index = 0
  let scaled = bytes
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024
    index += 1
  }
  const decimals = index === 0 ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  return `${compactNumber(scaled, decimals)} ${units[index]}`
}

export function formatRate (value) {
  const bytes = numeric(value)
  return bytes === null || bytes < 0 ? '—' : `${formatBytes(bytes)}/s`
}

export function formatDuration (value) {
  const seconds = numeric(value)
  if (seconds === null || seconds < 0) {
    return '—'
  }
  let remaining = Math.floor(seconds)
  const days = Math.floor(remaining / 86400)
  remaining %= 86400
  const hours = Math.floor(remaining / 3600)
  remaining %= 3600
  const minutes = Math.floor(remaining / 60)
  const secs = remaining % 60
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${String(secs).padStart(2, '0')}s`
  }
  return `${secs}s`
}

export const MONITOR_ITEM_GROUP = {
  hostname: 'sysinfo',
  cpu: 'cpu',
  cpuHistory: 'cpu',
  memory: 'memory',
  upload: 'network',
  download: 'network',
  uptime: 'uptime',
  users: 'users',
  disks: 'disks',
  swap: 'memory',
  network: 'network',
  activities: 'activities'
}

const DISK_PRIORITY = ['/', '/home', '/var', '/data']

// Selectable info panel sections, in the order they are displayed.
// `mem` is the config id, `memory` is the monitor group id.
export const INFO_PANEL_ITEM_IDS = Object.freeze([
  'uptime',
  'cpu',
  'mem',
  'activities',
  'network',
  'disks',
  'users'
])

const INFO_PANEL_ORDER = [
  'hostname',
  'uptime',
  'cpu',
  'memory',
  'swap',
  'activities',
  'network',
  'disks',
  'users'
]

export function groupOf (snapshot, name) {
  return snapshot.groups[name] || {
    status: 'idle',
    data: null,
    updatedAt: null,
    error: null
  }
}

export function sortDisks (disks) {
  return [...(Array.isArray(disks) ? disks : [])].sort((a, b) => {
    const ai = DISK_PRIORITY.indexOf(a.mount)
    const bi = DISK_PRIORITY.indexOf(b.mount)
    const ar = ai === -1 ? DISK_PRIORITY.length : ai
    const br = bi === -1 ? DISK_PRIORITY.length : bi
    return ar - br || a.mount.localeCompare(b.mount)
  })
}

export function getInfoPanelItems (items = []) {
  const selected = new Set(['hostname', ...items.map(id => id === 'mem' ? 'memory' : id)])
  if (selected.has('memory')) selected.delete('swap')
  // Always render in the fixed order, no matter how the user toggled them
  return INFO_PANEL_ORDER.filter(id => selected.has(id) && MONITOR_ITEM_GROUP[id])
}
