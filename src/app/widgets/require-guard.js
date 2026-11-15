/**
 * What a widget's server script is allowed to require.
 *
 * A widget's main.js is an ordinary node module in the host process, so before
 * this guard it could require anything: `electron` (breaks the web app
 * outright), the host's own internals, or a path that walks out of its folder.
 * Two rules, both enforced at require time:
 *
 *   1. node built-ins and files inside the widget folder (its own sources and
 *      its own node_modules) are allowed. Whatever it shipped is its business —
 *      express, openpgp, ftp-srv: the dependency was in the repo the user chose
 *      to install.
 *   2. everything else is refused with a message that names the widget and the
 *      replacement, in particular `electron` -> '@electerm/widget-api'.
 *
 * This is a platform-independence boundary, not a sandbox: a widget that wants
 * to escape can still use `process.binding` or spawn a process. What it buys is
 * that the desktop-only surface stops being reachable by accident, and that the
 * failure reads as "this widget needs desktop electerm" instead of
 * "Cannot find module 'electron'" from inside somebody else's code.
 */

const Module = require('module')
const path = require('path')
const fs = require('fs')
const { getUserWidgetDir } = require('./paths')

const API_PACKAGE = '@electerm/widget-api'

const BLOCKED = new Map([
  [
    'electron',
    `use require('${API_PACKAGE}') instead: it is backed by electron in the desktop app and by the server in the web app`
  ]
])

let installed = false
let roots = null

// Lazy: DATA_PATH is set after the app (or a test) starts, and this module is
// required at load time from load-widget.js.
//
// Two spellings on purpose: node records a module's filename after resolving
// symlinks (macOS /tmp -> /private/tmp, a data dir behind a link), while the
// widgets root is whatever DATA_PATH / appProps says. Comparing only one of
// them silently disables the guard on those machines.
function widgetRoots () {
  if (!roots) {
    const dir = path.resolve(getUserWidgetDir())
    roots = new Set([dir])
    try {
      roots.add(fs.realpathSync(dir))
    } catch (e) {}
  }
  return roots
}

// [root, relative path] when `file` is inside the widgets root, else null
function locate (file) {
  if (!file) {
    return null
  }
  for (const root of widgetRoots()) {
    const rel = path.relative(root, file)
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return [root, rel]
    }
  }
  return null
}

function inWidgets (file) {
  return !!locate(file)
}

function widgetIdOf (file) {
  const found = locate(file)
  return (found && found[1].split(path.sep)[0]) || 'widget'
}

function isBuiltin (request) {
  const name = request.startsWith('node:') ? request.slice(5) : request
  return Module.builtinModules.includes(name)
}

function resolveRequest (request, parent) {
  try {
    return Module._resolveFilename(request, parent, false)
  } catch (e) {
    // node's own "cannot find module" is clearer than anything added here
    return ''
  }
}

function check (request, parent) {
  if (!parent || !parent.filename || typeof request !== 'string') {
    return
  }
  if (!inWidgets(parent.filename)) {
    return
  }
  if (request.startsWith('node:') || isBuiltin(request)) {
    return
  }
  const id = widgetIdOf(parent.filename)
  const blocked = BLOCKED.get(request)
  if (blocked) {
    throw new Error(`widget ${id} may not require '${request}': ${blocked}`)
  }
  // Relative and absolute requests are checked as written: resolving first
  // would let a path that leaves the folder fail as "cannot find module",
  // which hides the real problem behind a missing-file message.
  if (request.startsWith('.') || path.isAbsolute(request)) {
    const target = path.resolve(path.dirname(parent.filename), request)
    if (!inWidgets(target)) {
      throw new Error(
        `widget ${id} may not require '${request}': it resolves outside the widget folder (${target})`
      )
    }
    return
  }
  const target = resolveRequest(request, parent)
  if (!target) {
    return
  }
  if (!inWidgets(target)) {
    throw new Error(
      `widget ${id} may not require '${request}': it resolves outside the widget folder (${target})`
    )
  }
}

function install () {
  if (installed) {
    return
  }
  installed = true
  const load = Module._load
  Module._load = function (request, parent, isMain) {
    check(request, parent)
    return load.call(this, request, parent, isMain)
  }
}

// unit tests only: re-read the widgets root after changing DATA_PATH
function reset () {
  roots = null
}

module.exports = {
  install,
  reset,
  check,
  BLOCKED
}
