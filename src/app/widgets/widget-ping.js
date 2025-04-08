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
  constructor () {
    this.isRunning = false
  }

  async pingURL (url = DEFAULTS.url, timeout = DEFAULTS.timeout) {
    try {
      const startTime = Date.now()
      const response = await axios.get(url, { timeout })
      const endTime = Date.now()

      return {
        success: true,
        url,
        status: response.status,
        statusText: response.statusText,
        responseTime: endTime - startTime,
        headers: response.headers
      }
    } catch (error) {
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
    }
  }

  getStatus () {
    return {
      status: this.isRunning ? 'running' : 'idle'
    }
  }
}

function widgetRun () {
  return new URLPingTool()
}

module.exports = {
  widgetInfo,
  widgetRun
}
