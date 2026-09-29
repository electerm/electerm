// load-widget.js

const fs = require('fs')
const path = require('path')
const widgetLog = require('./instance-log')
// const log = require('../common/log')

// Store running widget instances
const runningInstances = new Map()
const widgetIdPattern = /^[a-z0-9-]+$/

function resolveWidgetPath (widgetId, widgetDirectory = __dirname) {
  if (typeof widgetId !== 'string' || !widgetIdPattern.test(widgetId)) {
    throw new Error(`Invalid widget ID: ${widgetId}`)
  }

  const widgetPath = path.resolve(widgetDirectory, `widget-${widgetId}.js`)
  const relativePath = path.relative(widgetDirectory, widgetPath)

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
        id: file.slice(7, -3),
        info: widgetModule.widgetInfo
      })
    } catch (error) {
      console.error(`Error loading widget from file ${file}:`, error)
      continue
    }
  }
  return res
}

function listWidgets () {
  const widgets1 = listWidgetsFromFolder()
  return widgets1
  // if (process.versions.electron === undefined) {
  //   return widgets1
  // }
  // const {
  //   appPath
  // } = require('../common/app-props')
  // const userWidgetsDir = path.resolve(
  //   appPath, 'widgets'
  // )
  // // Ensure user widgets directory exists when app starts
  // try {
  //   if (!fs.existsSync(userWidgetsDir)) {
  //     fs.mkdirSync(userWidgetsDir, { recursive: true })
  //   }
  // } catch (err) {
  //   log.error(`Failed to create user widgets directory ${userWidgetsDir}:`, err)
  // }
  // const widgets2 = listWidgetsFromFolder(
  //   userWidgetsDir
  // )
  // return [
  //   ...widgets1,
  //   ...widgets2
  // ]
}

function hasRunningInstance (widgetId) {
  for (const [, instance] of runningInstances) {
    if (instance.widgetId === widgetId) {
      return true
    }
  }
  return false
}

function runWidget (widgetId, config) {
  const widget = require(resolveWidgetPath(widgetId))

  const { type, singleInstance } = widget.widgetInfo
  if (type !== 'instance') {
    return widget.widgetRun(config)
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
  logger.log('info', `Starting ${widget.widgetInfo.name} (${widgetId})`)

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
  runWidgetFunc
}
