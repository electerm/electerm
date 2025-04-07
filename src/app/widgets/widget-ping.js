const axios = require('axios')
const EventEmitter = require('events')

const widgetInfo = {
  name: 'URL Ping Tool',
  description: 'Ping a URL and get response details',
  version: '1.0.0',
  author: 'AI Assistant',
  configs: [
    {
      name: 'url',
      type: 'string',
      default: 'https://www.example.com',
      description: 'The URL to ping'
    },
    {
      name: 'timeout',
      type: 'number',
      default: 5000,
      description: 'Timeout in milliseconds'
    }
  ]
}

class URLPingTool extends EventEmitter {
  constructor (config) {
    super()
    this.config = config
    this.isRunning = false
  }

  async pingURL () {
    this.isRunning = true
    const { url, timeout } = this.config

    try {
      const startTime = Date.now()
      const response = await axios.get(url, { timeout })
      const endTime = Date.now()

      const result = {
        url,
        status: response.status,
        statusText: response.statusText,
        responseTime: endTime - startTime,
        headers: response.headers
      }

      this.emit('pingComplete', result)
    } catch (error) {
      let errorMessage = 'An error occurred'
      if (error.response) {
        errorMessage = `HTTP error! status: ${error.response.status}`
      } else if (error.request) {
        errorMessage = 'No response received'
      } else {
        errorMessage = error.message
      }

      this.emit('error', { url, error: errorMessage })
    } finally {
      this.isRunning = false
    }
  }

  async start () {
    if (this.isRunning) {
      throw new Error('URL ping is already in progress')
    }
    await this.pingURL()
  }

  getStatus () {
    return {
      status: this.isRunning ? 'running' : 'idle',
      config: this.config
    }
  }
}

function widgetRun (config) {
  return new URLPingTool(config)
}

module.exports = {
  widgetInfo,
  widgetRun
}
