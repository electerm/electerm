// widget-ping.js
const axios = require('axios')
// Define defaults in one place
const DEFAULTS = {
  url: 'https://www.example.com',
  timeout: 5000
}

const widgetInfo = {
  name: 'URL Ping Tool',
  description: 'Ping a URL and get response details',
  version: '1.0.0',
  author: 'AI Assistant',
  configs: [
    {
      name: 'url',
      type: 'string',
      default: DEFAULTS.url,
      description: 'The URL to ping'
    },
    {
      name: 'timeout',
      type: 'number',
      default: DEFAULTS.timeout,
      description: 'Timeout in milliseconds'
    }
  ]
}

class URLPingTool {
  constructor (config = {}) {
    this.isRunning = false
    this.config = {
      ...DEFAULTS,
      ...config
    }
    // Generate a unique instance ID
    this.instanceId = 'ping-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
  }

  start () {
    this.isRunning = true
    return Promise.resolve({
      url: this.config.url,
      status: 'started'
    })
  }

  stop () {
    this.isRunning = false
    return Promise.resolve({
      status: 'stopped'
    })
  }

  pingURL (url = this.config.url, timeout = this.config.timeout) {
    const startTime = Date.now()

    return axios.get(url, { timeout })
      .then(response => {
        const endTime = Date.now()
        return {
          success: true,
          url,
          status: response.status,
          statusText: response.statusText,
          responseTime: endTime - startTime,
          headers: response.headers
        }
      })
      .catch(error => {
        let errorMessage = 'An error occurred'

        if (error.response) {
          errorMessage = `HTTP error! status: ${error.response.status}`
        } else if (error.request) {
          errorMessage = 'No response received'
        } else {
          errorMessage = error.message
        }

        return {
          success: false,
          url,
          error: errorMessage
        }
      })
  }

  getStatus () {
    return {
      status: this.isRunning ? 'running' : 'idle'
    }
  }
}

function widgetRun (config = {}) {
  return new URLPingTool(config)
}

module.exports = {
  widgetInfo,
  widgetRun
}
