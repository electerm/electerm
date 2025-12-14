// load-widget.js

const fs = require('fs')
const path = require('path')
// const log = require('../common/log')

// Store running widget instances
const runningInstances = new Map()

function listWidgetsFromFolder (widgetDirectory = __dirname) {
  const widgetFiles = fs.readdirSync(widgetDirectory).filter(file => file.startsWith('widget-') && file.endsWith('.js'))
  const res = []
  for (const file of widgetFiles) {
    try {
      const widgetModule = require(path.join(widgetDirectory, file))
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

function runWidget (widgetId, config) {
  const file = `widget-${widgetId}.js`
  const widget = require(path.join(__dirname, file))

  const { type } = widget.widgetInfo
  if (type !== 'instance') {
    return widget.widgetRun(config)
  }

  const instance = widget.widgetRun(config)
  runningInstances.set(instance.instanceId, instance)

  return instance.start()
    .then(serverInfo => {
      return {
        instanceId: instance.instanceId,
        widgetId: widget.id,
        serverInfo
      }
    })
}

function stopWidget (instanceId) {
  const instance = runningInstances.get(instanceId)
  if (!instance) {
    console.error(`No running instance found for instanceId: ${instanceId}`)
    return
  }

  return instance.stop()
    .then(() => {
      runningInstances.delete(instanceId)
      return { instanceId, status: 'stopped' }
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
