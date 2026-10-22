// load-widget.js

const fs = require('fs')
const path = require('path')
const widgetLog = require('./instance-log')
const {
  listUserWidgets,
  resolveUserWidgetEntry,
  isUserWidget,
  importWidget,
  removeUserWidget,
  getUserWidgetDir
} = require('./user-widget')
const { isValidWidgetId } = require('./paths')
// const log = require('../common/log')

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

async function runWidget (widgetId, config) {
  const { entry } = resolveWidgetModule(widgetId)
  const widget = require(entry)
  const info = getWidgetInfo(widgetId)
  const { type, singleInstance } = info

  if (type !== 'instance') {
    // A UI-only widget (frontend) has nothing to start: the panel is its
    // renderer. No widgetRun is not an error there.
    if (typeof widget.widgetRun !== 'function') {
      return { success: true }
    }
    return widget.widgetRun(config)
  }

  if (typeof widget.widgetRun !== 'function') {
    throw new Error(`Widget ${widgetId} has no widgetRun export`)
  }

  // Check if singleInstance widget already has a running instance
  if (singleInstance && hasRunningInstance(widgetId)) {
    return Promise.reject(new Error(`Widget ${widgetId} already has a running instance. Only one instance is allowed.`))
  }

  // The widget reports through this context; it is handed the instance log
  // before it knows its own instanceId (see instance-log.js createContext).
  const ctx = widgetLog.createContext()
  const instance = widget.widgetRun(config, ctx)
  instance.widgetId = widgetId
  runningInstances.set(instance.instanceId, instance)
  ctx.bind(instance.instanceId)

  const logger = widgetLog.loggerFor(instance.instanceId)
  logger.log('info', `Starting ${info.name} (${widgetId})`)

  return instance.start()
    .then((result) => {
      logger.log('info', result && result.msg ? result.msg : 'Started')
      return {
        instanceId: instance.instanceId,
        widgetId,
        singleInstance: !!singleInstance,
        ...result
      }
    })
    .catch((err) => {
      // kept in the log file on purpose: this is what the user opens the panel
      // to read when the widget refuses to start
      logger.log('error', `Failed to start: ${err && err.message ? err.message : err}`)
      runningInstances.delete(instance.instanceId)
      return instance.stop().catch(() => {}).then(() => { throw err })
    })
}

/**
 * Call an exported function on a widget's main-process module.
 *
 * This is what a custom widget UI talks to: for `frontend` widgets there is no
 * instance to call methods on (runWidgetFunc needs one), and patching ipc.js is
 * not an option for code that ships after the app does. Only own properties are
 * reachable, the same rule the ipc bridge itself follows.
 */
async function callWidgetFunc (widgetId, funcName, ...args) {
  const { entry } = resolveWidgetModule(widgetId)
  const widget = require(entry)
  if (
    typeof funcName !== 'string' ||
    !Object.prototype.hasOwnProperty.call(widget, funcName) ||
    typeof widget[funcName] !== 'function'
  ) {
    throw new Error(`Widget ${widgetId} does not export the function ${funcName}`)
  }
  return widget[funcName](...args)
}

// Install: copy a whole widget folder into <data dir>/widgets/<id>/
function importWidgetFolder (srcDir, overwrite) {
  return importWidget(srcDir, overwrite)
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
  deleteWidget,
  resolveWidgetModule
}
