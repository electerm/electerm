const {
  test: it, expect
} = require('@playwright/test')
const { describe } = it

const { listWidgets, runWidget, stopWidget, runWidgetFunc } = require('../../src/app/widgets/load-widget')
const express = require('express')
const http = require('http')

it.setTimeout(100000)
describe('widget-ping', function () {
  let server = null
  let app = null
  const testPort = 3456
  let testUrl = null
  let widgetInstance = null

  // Setup before tests
  it.beforeEach(async () => {
    // Create Express app
    app = express()
    app.get('/success', (req, res) => {
      res.status(200).send('OK')
    })
    app.get('/timeout', (req, res) => {
      // Wait longer than the default timeout
      setTimeout(() => {
        res.status(200).send('Delayed response')
      }, 6000)
    })
    app.get('/error', (req, res) => {
      res.status(500).send('Internal Server Error')
    })

    // Start server
    server = http.createServer(app)
    await new Promise(resolve => {
      server.listen(testPort, '127.0.0.1', resolve)
    })
    testUrl = `http://127.0.0.1:${testPort}`
  })

  // Cleanup after tests
  it.afterEach(async () => {
    if (widgetInstance) {
      await stopWidget(widgetInstance)
      widgetInstance = null
    }

    if (server) {
      await new Promise(resolve => server.close(resolve))
      server = null
    }
  })

  // Test the ping widget availability
  it('should have ping widget available', async function () {
    const widgets = listWidgets()
    expect(Array.isArray(widgets)).toBe(true)

    const pingWidget = widgets.find(w => w.id === 'ping')
    expect(pingWidget).toBeTruthy()
    expect(pingWidget.info.name).toBe('URL Ping Tool')
  })

  // Test running and stopping the widget
  it('should run and stop the ping widget', async function () {
    const config = {
      url: `${testUrl}/success`,
      timeout: 2000
    }

    const result = await runWidget('ping', config)
    expect(result).toBeTruthy()
    expect(result.instanceId).toBeTruthy()
    expect(result.serverInfo).toBeTruthy()

    widgetInstance = result.instanceId

    const stopResult = await stopWidget(widgetInstance)
    expect(stopResult).toBeTruthy()
    expect(stopResult.status).toBe('stopped')

    widgetInstance = null
  })

  // Test ping functionality
  it('should successfully ping a valid URL', async function () {
    const config = {
      url: `${testUrl}/success`,
      timeout: 2000
    }

    const result = await runWidget('ping', config)
    widgetInstance = result.instanceId

    const pingResult = await runWidgetFunc(widgetInstance, 'pingURL', `${testUrl}/success`)
    expect(pingResult).toBeTruthy()
    expect(pingResult.success).toBe(true)
    expect(pingResult.status).toBe(200)
    expect(pingResult.responseTime).toBeDefined()
  })

  // Test error response
  it('should handle error responses correctly', async function () {
    const config = {
      url: `${testUrl}/success`,
      timeout: 2000
    }

    const result = await runWidget('ping', config)
    widgetInstance = result.instanceId

    const pingResult = await runWidgetFunc(widgetInstance, 'pingURL', `${testUrl}/error`)
    expect(pingResult).toBeTruthy()
    expect(pingResult.success).toBe(true) // Request succeeds but with error status
    expect(pingResult.status).toBe(500)
  })

  // Test timeout
  it('should handle timeouts correctly', async function () {
    const config = {
      url: `${testUrl}/success`,
      timeout: 2000
    }

    const result = await runWidget('ping', config)
    widgetInstance = result.instanceId

    const pingResult = await runWidgetFunc(widgetInstance, 'pingURL', `${testUrl}/timeout`, 1000)
    expect(pingResult).toBeTruthy()
    expect(pingResult.success).toBe(false)
    expect(pingResult.error).toBeTruthy()
  })

  // Test widget status
  it('should return widget status', async function () {
    const config = {
      url: `${testUrl}/success`,
      timeout: 2000
    }

    const result = await runWidget('ping', config)
    widgetInstance = result.instanceId

    const status = await runWidgetFunc(widgetInstance, 'getStatus')
    expect(status).toBeTruthy()
    expect(status.status).toBe('running')
  })
})
