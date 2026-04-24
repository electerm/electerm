/**
 * User-widget manager
 *
 * Handles CRUD for user-created widgets stored in
 *   {appPath}/electerm/widgets/widget-{id}.js
 *
 * Also provides a `testRunUserWidget` helper that evaluates a widget code
 * string in a sandbox so the user can verify it before saving.
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const uid = require('../common/uid')

// ── path helpers ────────────────────────────────────────────────────────────

function getUserWidgetsDir () {
  const { appPath } = require('../common/app-props')
  return path.resolve(appPath, 'electerm', 'widgets')
}

function ensureDir (dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function widgetFilePath (widgetDir, widgetId) {
  return path.join(widgetDir, `widget-${widgetId}.js`)
}

// ── read the default template ────────────────────────────────────────────────

function getDefaultWidgetTemplate () {
  return fs.readFileSync(
    path.join(__dirname, 'default-widget-template.js'),
    'utf8'
  )
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * List all user-created widgets.
 * Returns [{ id, code, info }]
 */
function listUserWidgets () {
  const widgetDir = getUserWidgetsDir()
  ensureDir(widgetDir)

  const files = fs.readdirSync(widgetDir)
    .filter(f => f.startsWith('widget-') && f.endsWith('.js'))

  const result = []
  for (const file of files) {
    const widgetId = file.slice(7, -3) // strip 'widget-' prefix and '.js' suffix
    const filePath = widgetFilePath(widgetDir, widgetId)
    try {
      const code = fs.readFileSync(filePath, 'utf8')
      const mod = safeLoadWidget(code, filePath)
      result.push({
        id: widgetId,
        code,
        info: mod.widgetInfo,
        userCreated: true
      })
    } catch (err) {
      console.error(`Error loading user widget ${file}:`, err)
    }
  }
  return result
}

/**
 * Create a new user widget.
 * If code is omitted the default template is used.
 * Returns { id, code, info }.
 */
function createUserWidget (code) {
  const widgetDir = getUserWidgetsDir()
  ensureDir(widgetDir)

  const widgetId = uid()
  const widgetCode = code || getDefaultWidgetTemplate()

  // Validate before saving
  const mod = safeLoadWidget(widgetCode)

  const filePath = widgetFilePath(widgetDir, widgetId)
  fs.writeFileSync(filePath, widgetCode, 'utf8')

  return { id: widgetId, code: widgetCode, info: mod.widgetInfo, userCreated: true }
}

/**
 * Update (overwrite) an existing user widget.
 * Returns { id, code, info }.
 */
function updateUserWidget (widgetId, code) {
  const widgetDir = getUserWidgetsDir()
  const filePath = widgetFilePath(widgetDir, widgetId)

  if (!fs.existsSync(filePath)) {
    throw new Error(`User widget not found: ${widgetId}`)
  }

  // Validate before saving
  const mod = safeLoadWidget(code)

  fs.writeFileSync(filePath, code, 'utf8')
  return { id: widgetId, code, info: mod.widgetInfo, userCreated: true }
}

/**
 * Delete a user widget by id.
 */
function deleteUserWidget (widgetId) {
  const widgetDir = getUserWidgetsDir()
  const filePath = widgetFilePath(widgetDir, widgetId)

  if (!fs.existsSync(filePath)) {
    throw new Error(`User widget not found: ${widgetId}`)
  }

  fs.unlinkSync(filePath)
  return { id: widgetId, deleted: true }
}

// ── safe loading ──────────────────────────────────────────────────────────────

/**
 * Load a widget from a code string (or file path for cache-busting).
 * Rewrites `require(...)` calls so that unknown packages are resolved via
 * customRequire, which installs them on demand.
 *
 * This is a *synchronous* helper used only to extract `widgetInfo` during
 * listing / saving.  The actual runtime execution goes through runUserWidget().
 */
function safeLoadWidget (code, filePath) {
  // Patch require → customRequire wrapper so the module can be parsed without
  // actually downloading packages at load time.
  const patchedCode = patchRequire(code)

  const mod = { exports: {} }
  const wrappedCode = `(function(module, exports, require, __filename, __dirname) { ${patchedCode} })`

  try {
    const fn = vm.runInThisContext(wrappedCode, {
      filename: filePath || 'user-widget.js'
    })
    const fakeRequire = makeFakeRequire(filePath)
    fn(
      mod,
      mod.exports,
      fakeRequire,
      filePath || 'user-widget.js',
      filePath ? path.dirname(filePath) : __dirname
    )
  } catch (err) {
    throw new Error(`Widget code error: ${err.message}`)
  }

  if (!mod.exports || typeof mod.exports.widgetInfo !== 'object') {
    throw new Error('Widget must export a widgetInfo object')
  }
  if (typeof mod.exports.widgetRun !== 'function') {
    throw new Error('Widget must export a widgetRun function')
  }

  return mod.exports
}

/**
 * Replace `require(` with a call to our custom-require shim so that third-party
 * packages are auto-installed when actually executed.
 */
function patchRequire (code) {
  // Replace top-level require calls with __widgetRequire
  // We only patch the literal `require(` token to avoid breaking destructuring etc.
  return code.replace(/\brequire\s*\(/g, '__widgetRequire(')
}

/**
 * A synchronous fake-require used only during safeLoadWidget (validation).
 * It tries the real require first; on failure it returns a Proxy stub so the
 * module can still be parsed and widgetInfo extracted without installing packages.
 */
function makeFakeRequire (filePath) {
  const baseDir = filePath ? path.dirname(filePath) : __dirname
  return function fakeRequire (mod) {
    try {
      // Relative paths resolved against widget file location
      if (mod.startsWith('.')) {
        return require(path.resolve(baseDir, mod))
      }
      return require(mod)
    } catch (_) {
      // Return a stub so widgetInfo can still be read
      return new Proxy({}, {
        get: (_, key) => {
          if (key === '__esModule') return false
          return () => {}
        }
      })
    }
  }
}

// ── test-run ──────────────────────────────────────────────────────────────────

/**
 * Test-run a widget code string with the supplied config.
 * Wires up customRequire so packages are installed on demand.
 * Returns whatever widgetRun() returns (or { started: true } for instances).
 */
async function testRunUserWidget (code, config = {}) {
  const { customRequire } = require('../lib/custom-require')
  const patchedCode = patchRequire(code)

  const mod = { exports: {} }
  const wrappedCode = `(function(module, exports, __widgetRequire, require, __filename, __dirname) { ${patchedCode} })`

  let fn
  try {
    fn = vm.runInThisContext(wrappedCode, { filename: 'test-user-widget.js' })
  } catch (err) {
    throw new Error(`Widget syntax error: ${err.message}`)
  }

  // __widgetRequire is async-capable: returns a promise for missing packages
  function widgetRequire (moduleName) {
    if (moduleName.startsWith('.')) {
      return require(path.resolve(__dirname, moduleName))
    }
    try {
      return require(moduleName)
    } catch (_) {
      // Return a thenable proxy; the real load happens lazily
      return customRequire(moduleName)
    }
  }

  fn(
    mod,
    mod.exports,
    widgetRequire, // __widgetRequire
    widgetRequire, // also expose as require for convenience
    'test-user-widget.js',
    __dirname
  )

  const { widgetInfo, widgetRun } = mod.exports
  if (!widgetInfo || typeof widgetRun !== 'function') {
    throw new Error('Widget must export widgetInfo and widgetRun')
  }

  const result = widgetRun(config)

  // Handle instance widgets: just start() and immediately stop()
  if (widgetInfo.type === 'instance') {
    if (!result || typeof result.start !== 'function') {
      throw new Error('Instance widget widgetRun() must return an object with start()')
    }
    const startResult = await result.start()
    if (typeof result.stop === 'function') {
      await result.stop()
    }
    return { ...startResult, testRun: true }
  }

  // For promises
  if (result && typeof result.then === 'function') {
    return result
  }
  return result
}

module.exports = {
  listUserWidgets,
  createUserWidget,
  updateUserWidget,
  deleteUserWidget,
  testRunUserWidget,
  getDefaultWidgetTemplate
}
