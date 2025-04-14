const axios = require('axios')
const uid = require('../common/uid')

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
    // Use the uid module to generate a unique instance ID
    this.instanceId = uid()
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
        if (error.response) {
          // We got a response, so the request technically succeeded
          // but with an error status code (e.g. 404, 500)
          const endTime = Date.now()
          return {
            success: true, // Mark as successful since we got a response
            url,
            status: error.response.status,
            statusText: error.response.statusText,
            responseTime: endTime - startTime,
            headers: error.response.headers
          }
        } else if (error.request) {
          // We made the request but got no response
          return {
            success: false,
            url,
            error: 'No response received'
          }
        } else {
          // Something else went wrong
          return {
            success: false,
            url,
            error: error.message
          }
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
