// load-widget.js

const fs = require('fs')
const path = require('path')
// const { app } = require('electron')

// Store running widget instances
const runningInstances = new Map()

function listWidgets () {
  const widgetDirectory = __dirname
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

function runWidget (widgetId, config) {
  const file = `widget-${widgetId}.js`
  const widget = require(path.join(__dirname, file))

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
  stopWidget
}
