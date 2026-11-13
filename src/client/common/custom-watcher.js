/**
 * Pure helpers for bookmark watchers: a shell command saved on an SSH bookmark
 * that the app runs on a fixed interval and shows next to the built-in monitor
 * items.
 *
 * Dependency-free on purpose -- `node --test src/test/unit-ci` loads this file
 * directly, and a `unit-ci` spec cannot resolve extensionless imports.
 */

export const DEFAULT_WATCHER_INTERVAL = 5
export const MIN_WATCHER_INTERVAL = 1
export const MAX_WATCHER_INTERVAL = 3600

const MAX_NAME_LENGTH = 40
const MAX_COMMAND_LENGTH = 2000
const FALLBACK_NAME = 'custom'

// `watch` keeps its own refresh loop, but the app polls on its own interval --
// and `watch` cannot run at all over a non-tty exec channel ("not a terminal"),
// so the wrapper is peeled off and only the inner command is run.
const WATCH_TOKEN = 'watch'
const WATCH_VALUE_FLAGS = new Set(['-n', '--interval'])

// `while true; do nvidia-smi; sleep 1; done` is the other common way to write a
// poller by hand. The pattern is strict on purpose: only an exact wrapper is
// unwrapped, anything else is left alone as the user typed it.
const LOOP_PATTERN = /^while\s+(?:true|:)\s*;\s*do\s+([\s\S]+?)\s*;?\s*sleep\s+([0-9]+(?:\.[0-9]+)?)s?\s*;?\s*done\s*;?$/

// Bookmarks come from config files and from the AI/MCP side, so nothing here may
// assume a string.
function asText (value) {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
}

function positiveNumber (value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    return null
  }
  return number
}

function truncate (text, maxLength) {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - 1)}…`
}

// Split on whitespace while honouring quotes, so `watch -n 1 'nvidia-smi -i 0'`
// yields the inner command as one token instead of three.
function tokenize (input) {
  const tokens = []
  let current = ''
  let quote = null
  let started = false
  for (const char of input) {
    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      started = true
      continue
    }
    if (/\s/.test(char)) {
      if (started) {
        tokens.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += char
    started = true
  }
  if (started) {
    tokens.push(current)
  }
  return tokens
}

// `/usr/bin/watch` is the same wrapper as `watch`.
function isWatchCall (tokens) {
  const head = tokens[0] || ''
  return head === WATCH_TOKEN || head.endsWith(`/${WATCH_TOKEN}`)
}

function unwrapWatch (tokens) {
  let interval = null
  let index = 1
  while (index < tokens.length) {
    const token = tokens[index]
    if (WATCH_VALUE_FLAGS.has(token)) {
      const value = positiveNumber(tokens[index + 1])
      if (value !== null) {
        interval = value
      }
      index += 2
      continue
    }
    // -n1 and --interval=1 are both accepted by watch itself
    const inline = token.match(/^(?:-n|--interval=)([0-9]+(?:\.[0-9]+)?)$/)
    if (inline) {
      const value = positiveNumber(inline[1])
      if (value !== null) {
        interval = value
      }
      index += 1
      continue
    }
    if (token.startsWith('-')) {
      // -d/-t/-g/-c/... take no value, just skip them
      index += 1
      continue
    }
    break
  }
  return {
    command: tokens.slice(index).join(' ').trim(),
    interval
  }
}

function unwrapLoop (loop, raw) {
  const command = loop[1].trim().replace(/;$/, '').trim()
  if (!command) {
    return { command: raw, interval: null }
  }
  return { command, interval: positiveNumber(loop[2]) }
}

/**
 * Normalize what the user typed into `{ command, interval }`.
 * `interval` is null when the input carries no interval of its own.
 */
export function parseWatcherCommand (input) {
  const raw = asText(input).trim()
  if (!raw) {
    return { command: '', interval: null }
  }
  const tokens = tokenize(raw)
  if (isWatchCall(tokens)) {
    const unwrapped = unwrapWatch(tokens)
    if (unwrapped.command) {
      return unwrapped
    }
    return { command: raw, interval: null }
  }
  const loop = raw.match(LOOP_PATTERN)
  if (loop) {
    return unwrapLoop(loop, raw)
  }
  return { command: raw, interval: null }
}

export function normalizeWatcherInterval (value, fallback = DEFAULT_WATCHER_INTERVAL) {
  const number = positiveNumber(value)
  if (number === null) {
    return fallback
  }
  const rounded = Math.round(number * 10) / 10
  return Math.min(MAX_WATCHER_INTERVAL, Math.max(MIN_WATCHER_INTERVAL, rounded))
}

export function watcherIntervalMs (watcher) {
  return normalizeWatcherInterval(watcher && watcher.interval) * 1000
}

// A name is optional: without one the executable name is a better label than
// "watcher 3", and it keeps the bar item readable.
export function watcherName (name, command) {
  const text = asText(name)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  if (text) {
    return text
  }
  const first = asText(command).trim().split(/\s+/)[0] || ''
  const base = first.split('/').pop().slice(0, MAX_NAME_LENGTH)
  if (base) {
    return base
  }
  return FALLBACK_NAME
}

function watcherId (input) {
  if (typeof input.id !== 'string') {
    return ''
  }
  return input.id.trim()
}

// A `watch -n 1 ...` wrapper supplies the interval when the watcher has none of
// its own; without either, the default keeps the bar from polling per second.
function intervalFallback (parsed) {
  if (parsed.interval === null) {
    return DEFAULT_WATCHER_INTERVAL
  }
  return parsed.interval
}

export function normalizeWatcher (input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }
  const id = watcherId(input)
  if (!id) {
    return null
  }
  const parsed = parseWatcherCommand(input.command)
  if (!parsed.command) {
    return null
  }
  return {
    id,
    name: watcherName(input.name, parsed.command),
    command: parsed.command.slice(0, MAX_COMMAND_LENGTH),
    interval: normalizeWatcherInterval(input.interval, intervalFallback(parsed)),
    enabled: input.enabled !== false
  }
}

export function normalizeWatchers (value) {
  if (!Array.isArray(value)) {
    return []
  }
  const result = []
  const seen = new Set()
  for (const entry of value) {
    const watcher = normalizeWatcher(entry)
    if (!watcher || seen.has(watcher.id)) {
      continue
    }
    seen.add(watcher.id)
    result.push(watcher)
  }
  return result
}

// The watchers that should actually run: switched off ones stay on the bookmark
// (they are easy to bring back) but cost no exec channel.
export function activeWatchers (value) {
  return normalizeWatchers(value).filter(watcher => watcher.enabled)
}

// One flag drives both surfaces: an enabled watcher is polled and listed, a
// disabled one stays on the bookmark but costs nothing. The filter controls and
// the bookmark form's switch all end up here.
export function toggleWatcher (value, id) {
  return normalizeWatchers(value).map(watcher => {
    if (watcher.id !== id) {
      return watcher
    }
    return { ...watcher, enabled: !watcher.enabled }
  })
}

// Filter controls label built-in items from the locale; a watcher has no key to
// translate, so it hands its own name over instead.
export function watcherLabels (watchers) {
  const labels = {}
  for (const watcher of watchers) {
    labels[watcher.id] = watcher.name
  }
  return labels
}

function firstMeaningfulLine (text) {
  return text
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(Boolean) || ''
}

// The bar item has one line of room, so the first non-empty line of the output
// is the value; the popover holds the rest.
export function summarizeWatcherOutput (output, maxLength = 60) {
  const line = firstMeaningfulLine(asText(output))
  if (!line) {
    return ''
  }
  return truncate(line, maxLength)
}

function watcherLabel (watcher) {
  if (watcher && watcher.name) {
    return watcher.name
  }
  return FALLBACK_NAME
}

// Only a ready watcher has output worth a summary; the popover explains why the
// others are empty.
function readySummary (state) {
  if (!state || state.status !== 'ready') {
    return ''
  }
  return summarizeWatcherOutput(state.output)
}

// Always prefixed with the name: the value alone ("Fri Nov 13 11:53:30") says
// nothing about which watcher produced it.
export function watcherBarSummary (watcher, state) {
  const summary = readySummary(state)
  if (!summary) {
    return `${watcherLabel(watcher)}: —`
  }
  return `${watcherLabel(watcher)}: ${summary}`
}

// Both surfaces that render a watcher (monitor bar popover, info panel) need the
// same `{ id: { watcher, state } }` shape for MonitorDetails.
export function watcherDetailMap (watchers, states) {
  const details = {}
  for (const watcher of watchers) {
    details[watcher.id] = { watcher, state: states[watcher.id] }
  }
  return details
}
