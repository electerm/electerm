// load-widget.js

const fs = require('fs')
const path = require('path')
const widgetLog = require('./instance-log')
const {
  listUserWidgets,
  resolveUserWidgetEntry,
  isUserWidget,
  importWidget,
  importWidgetFromSource,
  removeUserWidget,
  getUserWidgetDir
} = require('./user-widget')
const { importWidgetFromRegistry } = require('./widget-registry')
const { isValidWidgetId, resolveUserWidgetDir, isInside } = require('./paths')
const { sanitizeAIConfig } = require('./ai-config')
const widgetApi = require('./api')
const cssBus = require('./css-bus')
const { ensureApiModule } = require('./api-entry')
const requireGuard = require('./require-guard')
const { createProxyAgent } = require('../lib/proxy-agent')
// const log = require('../common/log')

// From here on a widget's main.js may only require its own files, its own
// dependencies, node built-ins and '@electerm/widget-api' (see the module).
requireGuard.install()

// Store running widget instances
const runningInstances = new Map()

function resolveBuiltinPath (widgetId) {
  if (!isValidWidgetId(widgetId)) {
    throw new Error(`Invalid widget ID: ${widgetId}`)
  }

  const widgetPath = path.resolve(__dirname, `widget-${widgetId}.js`)
  const relativePath = path.relative(__dirname, widgetPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid widget ID: ${widgetId}`)
  }

  return widgetPath
}

function listWidgetsFromFolder (widgetDirectory = __dirname) {
  const widgetFiles = fs.readdirSync(widgetDirectory).filter(file => file.startsWith('widget-') && file.endsWith('.js'))
  const res = []
  for (const file of widgetFiles) {
    try {
      const widgetModule = require(path.join(widgetDirectory, file))
      // a file matching widget-*.js is a widget by convention; anything else
      // living in this folder (a helper module) must not reach the renderer,
      // where an undefined `info` crashes the whole widget list
      if (!widgetModule.widgetInfo) {
        console.error(`Skipping ${file}: no widgetInfo export`)
        continue
      }
      res.push({
        id: file.slice(7, -3), // "widget-".length = 7, ".js" = 3
        builtin: true,
        state: 'ok',
        info: {
          ...widgetModule.widgetInfo,
          builtin: true
        }
      })
    } catch (error) {
      console.error(`Error loading widget from file ${file}:`, error)
      continue
    }
  }
  return res
}

/**
 * Built-ins ship with the app; user widgets live in <data dir>/widgets/<id>/.
 *
 * One namespace, no shadowing: a user folder that reuses a built-in id is
 * ignored, and the built-in carries a warning the list can show. Silently
 * letting a user widget replace mcp-server or ssh-server would break features
 * that have nothing to do with the widget panel.
 */
function listWidgets () {
  const widgets = listWidgetsFromFolder()
  const builtinIds = new Set(widgets.map(w => w.id))
  const userWidgets = listUserWidgets()
  for (const widget of userWidgets) {
    if (builtinIds.has(widget.id)) {
      const builtin = widgets.find(w => w.id === widget.id)
      builtin.warning = `User widget "${widget.id}" in ${getUserWidgetDir()} is ignored: the id belongs to a built-in widget`
      continue
    }
    widgets.push(widget)
  }
  return widgets
}

// Where the entry of one widget lives, whichever root it came from.
// `entry` is '' for a declarative user widget: one that only ships styles and
// has no server script at all (see readWidget in ./user-widget.js).
function resolveWidgetModule (widgetId) {
  if (!isValidWidgetId(widgetId)) {
    throw new Error(`Invalid widget ID: ${widgetId}`)
  }
  const builtinPath = resolveBuiltinPath(widgetId)
  if (fs.existsSync(builtinPath)) {
    return { entry: builtinPath, builtin: true }
  }
  if (isUserWidget(widgetId)) {
    return { entry: resolveUserWidgetEntry(widgetId), builtin: false }
  }
  throw new Error(`Widget not found: ${widgetId}`)
}

// Give a user widget's folder the '@electerm/widget-api' shim before its entry
// is required, so `require('@electerm/widget-api')` resolves there.
function prepareUserWidget (widgetId) {
  ensureApiModule(resolveUserWidgetDir(widgetId), widgetId)
}

// The css of a declarative widget: every file in `electerm.styles`, in order.
function declaredStyles (widgetId, info) {
  const dir = resolveUserWidgetDir(widgetId)
  const parts = []
  for (const rel of info.styles || []) {
    const file = path.resolve(dir, rel)
    if (!isInside(dir, file)) {
      throw new Error(`style file must stay inside the widget folder: ${rel}`)
    }
    try {
      parts.push(`/* ${rel} */\n` + fs.readFileSync(file, 'utf8'))
    } catch (e) {
      throw new Error(`cannot read ${rel}: ${e.message}`)
    }
  }
  return parts.join('\n')
}

/**
 * The css one instance applies: what its manifest declares (`declaredCss`, read
 * once at start) or what its script asked for (`css`), the latter winning and a
 * script that removed its css winning over the manifest.
 *
 * This is why there is no css store anywhere in the host: an instance is the
 * only thing that can have css, so stopping it, deleting the widget or quitting
 * the app cannot leave a stylesheet behind.
 */
function cssOf (instance) {
  if (!instance) {
    return ''
  }
  return instance.css === null || instance.css === undefined
    ? (instance.declaredCss || '')
    : instance.css
}

function instanceFor (widgetId) {
  for (const [, instance] of runningInstances) {
    if (instance.widgetId === widgetId) {
      return instance
    }
  }
  return null
}

// Send one widget's current css to every app window. '' removes it, which is
// what the renderer does when the last instance of that widget is gone.
function broadcastCss (widgetId) {
  const css = cssOf(instanceFor(widgetId))
  cssBus.send(widgetId, css)
  return css
}

/**
 * Every running instance, in the shape the widgets panel mirrors
 * (client/store/widgets.js refreshWidgetInstances).
 *
 * An instance only exists here, so this is what a renderer that just loaded —
 * a page reload, a second window — asks for instead of keeping its own list
 * that can drift from the truth. The panel used to build instances by hand
 * from each run result, which meant a reload left it showing nothing as
 * running while the instances were still alive.
 */
function listWidgetInstances () {
  return [...runningInstances.values()].map(instance => ({
    instanceId: instance.instanceId,
    widgetId: instance.widgetId,
    name: instance.name || instance.widgetId,
    startedAt: instance.startedAt || 0,
    config: instance.config || {},
    serverInfo: instance.serverInfo || null,
    aiConfig: instance.aiConfig || null
  }))
}

// What a renderer that loads while widgets are running has to re-apply
// (client/common/widget-style-host.js): derived, never stored.
function runningCss () {
  const out = {}
  for (const [, instance] of runningInstances) {
    const css = cssOf(instance)
    if (css) {
      out[instance.widgetId] = css
    }
  }
  return out
}

// The widget api's css calls land here (see ./api.js): they change the running
// instance and tell the renderer, nothing else.
widgetApi.configureCss({
  apply (widgetId, css) {
    const instance = instanceFor(widgetId)
    if (!instance) {
      throw new Error(`widget ${widgetId} is not running, so it has no stylesheet to change`)
    }
    instance.css = cssBus.sanitize(css)
    broadcastCss(widgetId)
    return instance.css
  },
  remove (widgetId) {
    const instance = instanceFor(widgetId)
    if (instance) {
      instance.css = ''
      broadcastCss(widgetId)
    }
    return ''
  },
  get (widgetId) {
    return cssOf(instanceFor(widgetId))
  }
})

// Metadata for one widget: the manifest for a user widget (the package.json is
// the source of truth), the widgetInfo export for a built-in.
function getWidgetInfo (widgetId) {
  const { entry, builtin } = resolveWidgetModule(widgetId)
  if (builtin) {
    const widgetModule = require(entry)
    if (!widgetModule.widgetInfo) {
      throw new Error(`Widget ${widgetId} has no widgetInfo export`)
    }
    return widgetModule.widgetInfo
  }
  const entryInfo = listUserWidgets().find(w => w.id === widgetId)
  if (!entryInfo || entryInfo.state !== 'ok') {
    throw new Error(entryInfo && entryInfo.error
      ? `Widget ${widgetId} is not usable: ${entryInfo.error}`
      : `Widget ${widgetId} not found`)
  }
  return entryInfo.info
}

function hasRunningInstance (widgetId) {
  for (const [, instance] of runningInstances) {
    if (instance.widgetId === widgetId) {
      return true
    }
  }
  return false
}

// A widget that is nothing but stylesheets: the manifest lists them, electerm
// reads and applies them, and there is no server script to require (see
// ./user-widget.js readWidget). Same lifecycle as any other instance, so the
// panel's Run/Stop and the auto-run list work unchanged.
function runDeclarativeWidget (widgetId, info, config) {
  const instanceId = `${widgetId}-${Date.now()}`
  const logger = widgetLog.loggerFor(instanceId)
  return {
    instanceId,
    widgetId,
    // same metadata a script instance carries, so listWidgetInstances can
    // describe both without special-casing
    name: info.name,
    startedAt: Date.now(),
    config: { ...(config || {}) },
    serverInfo: null,
    aiConfig: null,
    // set at start, and the source of every broadcast for this widget
    declaredCss: '',
    css: null,
    async start () {
      this.declaredCss = declaredStyles(widgetId, info)
      const css = broadcastCss(widgetId)
      const size = Buffer.byteLength(css, 'utf8')
      const msg = `${info.name} applied (${size} bytes of css)`
      logger.log('info', msg)
      return { success: true, msg }
    },
    async stop () {
      logger.log('info', 'style removed')
    }
  }
}

async function runWidget (widgetId, config) {
  const { entry, builtin } = resolveWidgetModule(widgetId)
  const info = getWidgetInfo(widgetId)
  const { type, singleInstance } = info
  // the '@electerm/widget-api' shim has to be on disk before the entry is
  // required; built-in widgets import the host's own modules and need nothing
  if (!builtin) {
    prepareUserWidget(widgetId)
  }
  const widget = entry ? require(entry) : {}

  if (type !== 'instance') {
    // A UI-only widget (frontend) has nothing to start: the panel is its
    // renderer. No widgetRun is not an error there.
    if (typeof widget.widgetRun !== 'function') {
      return { success: true }
    }
    return widget.widgetRun(config)
  }

  // Check if singleInstance widget already has a running instance
  if (singleInstance && hasRunningInstance(widgetId)) {
    return Promise.reject(new Error(`Widget ${widgetId} already has a running instance. Only one instance is allowed.`))
  }

  if (typeof widget.widgetRun !== 'function') {
    if (!(info.styles || []).length) {
      throw new Error(`Widget ${widgetId} has no widgetRun export`)
    }
    const instance = runDeclarativeWidget(widgetId, info, config)
    runningInstances.set(instance.instanceId, instance)
    widgetApi.bindInstance(widgetId, instance.instanceId)
    return instance.start()
      .then(result => ({
        instanceId: instance.instanceId,
        widgetId,
        singleInstance: !!singleInstance,
        ...result
      }))
      .catch((err) => {
        runningInstances.delete(instance.instanceId)
        widgetApi.unbindInstance(widgetId, instance.instanceId)
        throw err
      })
  }

  // The widget reports through this context; it is handed the instance log
  // before it knows its own instanceId (see instance-log.js createContext).
  // A widget that forwards AI traffic decides its own upstream proxy: electerm
  // only supplies the agent factory, so no proxy value leaks into widget config.
  const ctx = widgetLog.createContext()
  ctx.createProxyAgent = createProxyAgent
  const instance = widget.widgetRun({ ...(config || {}) }, ctx)
  instance.widgetId = widgetId
  // A UI widget's exported functions close over this module's state. Requiring
  // the entry again (a re-import purges the require cache) would hand the panel
  // a fresh module with empty state while this instance is still running.
  instance.widgetModule = widget
  // What the panel shows for a running instance (listWidgetInstances): the
  // widget's name, when it started, and the config it was started with.
  instance.name = info.name
  instance.startedAt = Date.now()
  instance.config = { ...(config || {}) }
  instance.serverInfo = null
  instance.aiConfig = null
  // A widget with a script may still declare stylesheets; its own api.css calls
  // then replace them (see cssOf).
  instance.declaredCss = !builtin && (info.styles || []).length
    ? declaredStyles(widgetId, info)
    : ''
  instance.css = null
  runningInstances.set(instance.instanceId, instance)
  ctx.bind(instance.instanceId)
  // api.log / api.event land in this instance's log from here on
  widgetApi.bindInstance(widgetId, instance.instanceId)

  const logger = widgetLog.loggerFor(instance.instanceId)
  logger.log('info', `Starting ${info.name} (${widgetId})`)

  return instance.start()
    .then((result) => {
      logger.log('info', result && result.msg ? result.msg : 'Started')
      // what the panel shows for this instance after a reload: the address it
      // serves on, and an AI config it offered (sanitised at the boundary, see
      // ./ai-config.js — the renderer only ever sees the whitelisted fields)
      instance.serverInfo = (result && result.serverInfo) || null
      instance.aiConfig = sanitizeAIConfig(result && result.aiConfig)
      // declared css (if any) goes live now, in the renderer
      broadcastCss(widgetId)
      return {
        instanceId: instance.instanceId,
        widgetId,
        singleInstance: !!singleInstance,
        ...result,
        aiConfig: instance.aiConfig
      }
    })
    .catch((err) => {
      // kept in the log file on purpose: this is what the user opens the panel
      // to read when the widget refuses to start
      logger.log('error', `Failed to start: ${err && err.message ? err.message : err}`)
      runningInstances.delete(instance.instanceId)
      widgetApi.unbindInstance(widgetId, instance.instanceId)
      // the window may already have the declared css of a widget that died
      if (!hasRunningInstance(widgetId)) {
        cssBus.send(widgetId, '')
      }
      return instance.stop().catch(() => {}).then(() => { throw err })
    })
}

/**
 * Call an exported function on a widget's main-process module.
 *
 * This is what a custom widget UI talks to: for `frontend` widgets there is no
 * instance to call methods on (runWidgetFunc needs one), and patching ipc.js is
 * not an option for code that ships after the app does. Only own properties are
 * reachable, the same rule the ipc bridge itself follows. When an instance is
 * running, its own module is used, so a re-import that clears the require cache
 * cannot leave the UI talking to a second, empty copy of the widget state.
 */
async function callWidgetFunc (widgetId, funcName, ...args) {
  const { entry, builtin } = resolveWidgetModule(widgetId)
  if (!builtin) {
    prepareUserWidget(widgetId)
  }
  // Prefer the module the running instance was created from: its state is the
  // state the widget UI is supposed to talk to. Frontend widgets have no
  // instance, so they fall back to a plain require.
  const running = [...runningInstances.values()]
    .find(({ widgetId: id }) => id === widgetId)
  if (!entry && !(running && running.widgetModule)) {
    throw new Error(`Widget ${widgetId} has no server script to call`)
  }
  const widget = (running && running.widgetModule) || require(entry)
  if (
    typeof funcName !== 'string' ||
    !Object.prototype.hasOwnProperty.call(widget, funcName) ||
    typeof widget[funcName] !== 'function'
  ) {
    throw new Error(`Widget ${widgetId} does not export the function ${funcName}`)
  }
  const result = await widget[funcName](...args)
  // same offer as a run result, same sanitising (see ./ai-config.js)
  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Object.prototype.hasOwnProperty.call(result, 'aiConfig')
  ) {
    return { ...result, aiConfig: sanitizeAIConfig(result.aiConfig) }
  }
  return result
}

// Install: copy a whole widget folder into <data dir>/widgets/<id>/
function importWidgetFolder (srcDir, overwrite) {
  return importWidget(srcDir, overwrite)
}

// Install from a git host: `owner/repo`, a GitHub/AtomGit URL, `owner/repo#ref`
// or a folder inside the repo (see ./widget-source.js)
function importWidgetFromUrl (input, overwrite) {
  return importWidgetFromSource(input, overwrite)
}

// Uninstall: stop whatever it is running, then delete the folder.
async function deleteWidget (widgetId) {
  const stops = []
  for (const [instanceId, instance] of runningInstances) {
    if (instance.widgetId === widgetId) {
      stops.push(stopWidget(instanceId).catch(() => {}))
    }
  }
  await Promise.allSettled(stops)
  // no instance left, so derived css is gone too; tell the windows
  cssBus.send(widgetId, '')
  return removeUserWidget(widgetId)
}

function stopWidget (instanceId) {
  const instance = runningInstances.get(instanceId)
  if (!instance) {
    console.error(`No running instance found for instanceId: ${instanceId}`)
    return
  }

  const logger = widgetLog.loggerFor(instanceId)
  logger.log('info', 'Stopping...')

  return instance.stop()
    .then(() => {
      logger.log('info', 'Stopped')
      runningInstances.delete(instanceId)
      widgetApi.unbindInstance(instance.widgetId, instanceId)
      // The css lived on the instance, so it is already gone here: broadcast the
      // recomputed value ('' once the last instance of that widget stopped).
      broadcastCss(instance.widgetId)
      return { instanceId, status: 'stopped' }
    })
    .catch((err) => {
      logger.log('error', `Failed to stop: ${err && err.message ? err.message : err}`)
      throw err
    })
}

async function runWidgetFunc (instanceId, funcName, ...args) {
  const instance = runningInstances.get(instanceId)
  if (!instance) {
    throw new Error(`No running instance found for instanceId: ${instanceId}`)
  }

  if (typeof instance[funcName] !== 'function') {
    throw new Error(`Function ${funcName} not found in widget instance`)
  }

  try {
    const result = await instance[funcName](...args)
    return result
  } catch (error) {
    console.error(`Error executing ${funcName} on widget instance ${instanceId}:`, error)
    widgetLog.loggerFor(instanceId).log('error', `${funcName} failed: ${error.message}`)
    throw error
  }
}

async function cleanup () {
  if (runningInstances.size === 0) {
    return
  }

  const stopPromises = []

  for (const [instanceId, instance] of runningInstances) {
    console.log(`Stopping widget instance: ${instanceId}`)
    try {
      const stopPromise = instance.stop()
        .then(() => {
          console.log(`Successfully stopped widget instance: ${instanceId}`)
        })
        .catch(err => {
          console.error(`Error stopping widget instance ${instanceId}:`, err)
        })
      stopPromises.push(stopPromise)
    } catch (err) {
      console.error(`Error initiating stop for widget instance ${instanceId}:`, err)
    }
  }

  try {
    await Promise.allSettled(stopPromises)
    runningInstances.clear()
    console.log('All widget instances have been stopped')
  } catch (err) {
    console.error('Error during cleanup:', err)
  }
}

// Register cleanup handlers only for process exit signals
function registerCleanupHandlers () {
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, cleaning up widgets...')
    await cleanup()
  })
}

// Initialize cleanup handlers
registerCleanupHandlers()

module.exports = {
  listWidgets,
  runWidget,
  stopWidget,
  runWidgetFunc,
  callWidgetFunc,
  importWidget: importWidgetFolder,
  importWidgetFromSource: importWidgetFromUrl,
  importWidgetFromRegistry,
  deleteWidget,
  resolveWidgetModule,
  // what a renderer that just loaded has to know about running widgets
  listWidgetInstances,
  // what a renderer that just loaded has to re-apply (client/common/widget-style-host.js)
  runningCss,
  broadcastCss
}
