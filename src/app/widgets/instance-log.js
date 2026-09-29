/**
 * Per-instance widget logs, written to <data dir>/widget_logs/<instanceId>.log.
 *
 * Widgets run in the main process and report with console.log, which lands in
 * the app's own stdout: invisible from the UI, and gone when the app exits. The
 * widget manager (Settings -> Widgets -> Running instances) instead shows two
 * streams for the selected instance, both read back out of this file — on open,
 * and again whenever the user presses Reload:
 *
 *   log   what the widget did: lifecycle, plus whatever the widget reports.
 *   conn  one entry per connection/request the widget served, marked ok/failed,
 *         so a client that cannot connect leaves a visible mark.
 *
 * Writing a file rather than keeping a buffer in memory means the log outlives
 * the instance and the app — which is the point, since the interesting case is
 * reading it *after* something broke.
 *
 * Entries arrive from two places:
 *   1. load-widget.js records the lifecycle (starting/started/stopped/failure).
 *   2. The widget calls the context it is handed — widgetRun(config, ctx), with
 *      ctx.log(level, ...args) and ctx.event({ type, ok, msg, from }). A widget
 *      that ignores ctx still runs, it just logs less.
 *
 * console output is deliberately NOT captured by patching console: attributing
 * it to an instance needs AsyncLocalStorage, and ALS does not survive into the
 * nested callbacks a server actually logs from (measured: a server's connection
 * callback keeps the scope, the socket's own 'data' handler loses it). A log
 * with silent holes is worse than one holding only what a widget reports on
 * purpose, so widgets report on purpose.
 *
 * Format — one entry per line, pipe separated, because the reader is a plain
 * split and a message may contain anything:
 *   <iso time>|log|<level>|<message>
 *   <iso time>|conn|<ok|fail|info>|<type>|<from>|<message>
 * Newlines inside a field are escaped as \n so one entry stays one line.
 */

const fs = require('fs')
const os = require('os')
const { join } = require('path')

const LOG_DIR_NAME = 'widget_logs'
// the reader loads the whole file on every change, so cap how big that gets
const MAX_FILE_SIZE = 1024 * 1024
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_MESSAGE_LENGTH = 4000

const LEVELS = ['debug', 'log', 'info', 'warn', 'error']

let logDir = ''
// bytes written per instance, so the rotation check does not stat on every line
const sizes = new Map()

// Same data dir as the db (see lib/db.js): DATA_PATH wins, else appData/electerm.
// Resolved lazily and defensively so this module can be required without
// electron (unit tests), where it falls back to a temp dir.
function resolveLogDir () {
  if (process.env.DATA_PATH) {
    return join(process.env.DATA_PATH, LOG_DIR_NAME)
  }
  try {
    const { appPath } = require('../common/app-props')
    return join(appPath, 'electerm', LOG_DIR_NAME)
  } catch (e) {
    return join(os.tmpdir(), 'electerm', LOG_DIR_NAME)
  }
}

function ensureDir (dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (e) {}
}

// Best effort: only ever touches *.log files inside our own directory.
function pruneOld () {
  let names = []
  try {
    names = fs.readdirSync(logDir)
  } catch (e) {
    return
  }
  const now = Date.now()
  for (const name of names) {
    if (!/\.log(\.\d+)?$/.test(name)) {
      continue
    }
    const p = join(logDir, name)
    try {
      if (now - fs.statSync(p).mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(p)
      }
    } catch (e) {}
  }
}

function getLogDir () {
  if (!logDir) {
    setLogDir(resolveLogDir())
  }
  return logDir
}

function setLogDir (dir) {
  logDir = dir
  ensureDir(logDir)
  pruneOld()
  return logDir
}

function logFilePath (instanceId) {
  return join(getLogDir(), `${instanceId}.log`)
}

function text (arg) {
  if (typeof arg === 'string') {
    return arg
  }
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`
  }
  if (arg === undefined) {
    return 'undefined'
  }
  if (arg === null) {
    return 'null'
  }
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg)
    } catch (e) {
      return String(arg)
    }
  }
  return String(arg)
}

function toMessage (args) {
  const msg = args.map(text).join(' ')
  return msg.length > MAX_MESSAGE_LENGTH
    ? msg.slice(0, MAX_MESSAGE_LENGTH) + '...'
    : msg
}

// keeps one entry on one line
function oneLine (v) {
  return text(v).replace(/\r?\n/g, '\\n')
}

// a separator field must not be able to add one
function token (v) {
  return oneLine(v).replace(/\|/g, '/')
}

function rotateIfBig (file) {
  try {
    if (fs.statSync(file).size <= MAX_FILE_SIZE) {
      return
    }
    const old = `${file}.1`
    if (fs.existsSync(old)) {
      fs.unlinkSync(old)
    }
    fs.renameSync(file, old)
  } catch (e) {}
}

function fileSize (file) {
  try {
    return fs.statSync(file).size
  } catch (e) {
    return 0
  }
}

// Appended synchronously on purpose: the log is a diagnostic record, so it has
// to be complete on disk the moment an entry happens — including when the app
// is about to die, which is exactly when someone goes looking at it. Volume is
// a few lines per connection, so the blocking write is not worth optimising.
function write (instanceId, line) {
  if (!instanceId) {
    return
  }
  const file = logFilePath(instanceId)
  const text = line + '\n'
  try {
    let size = sizes.has(instanceId) ? sizes.get(instanceId) : fileSize(file)
    if (size > MAX_FILE_SIZE) {
      rotateIfBig(file)
      size = fileSize(file)
    }
    fs.appendFileSync(file, text)
    sizes.set(instanceId, size + Buffer.byteLength(text))
  } catch (e) {}
}

function pushLog (instanceId, level, args) {
  write(instanceId, [
    new Date().toISOString(),
    'log',
    LEVELS.includes(level) ? level : 'log',
    oneLine(toMessage(args))
  ].join('|'))
}

function pushEvent (instanceId, event) {
  if (!event) {
    return
  }
  const state = event.ok === undefined || event.ok === null
    ? 'info'
    : (event.ok ? 'ok' : 'fail')
  write(instanceId, [
    new Date().toISOString(),
    'conn',
    state,
    token(event.type || 'event'),
    token(event.from || '-'),
    oneLine(event.msg || '')
  ].join('|'))
}

// log('server started') and log('error', 'boom') both do what you mean
function splitLevel (levelOrMsg, rest) {
  if (typeof levelOrMsg === 'string' && LEVELS.includes(levelOrMsg)) {
    return { level: levelOrMsg, args: rest }
  }
  return { level: 'log', args: [levelOrMsg, ...rest] }
}

function loggerFor (instanceId) {
  return {
    log: (levelOrMsg, ...rest) => {
      const { level, args } = splitLevel(levelOrMsg, rest)
      pushLog(instanceId, level, args)
    },
    event: (event) => pushEvent(instanceId, event)
  }
}

// The widget owns its instanceId (it generates one inside widgetRun), but may
// want to log before returning it — so log/event calls made before bind() are
// held and replayed against the real id.
function createContext () {
  const pending = []
  const ctx = {
    instanceId: '',
    bind (instanceId) {
      ctx.instanceId = instanceId
      while (pending.length) {
        pending.shift()(instanceId)
      }
    },
    log (levelOrMsg, ...rest) {
      const { level, args } = splitLevel(levelOrMsg, rest)
      if (ctx.instanceId) {
        pushLog(ctx.instanceId, level, args)
      } else {
        pending.push(id => pushLog(id, level, args))
      }
    },
    event (event) {
      if (ctx.instanceId) {
        pushEvent(ctx.instanceId, event)
      } else {
        pending.push(id => pushEvent(id, event))
      }
    }
  }
  return ctx
}

module.exports = {
  LEVELS,
  getLogDir,
  setLogDir,
  logFilePath,
  loggerFor,
  createContext
}
