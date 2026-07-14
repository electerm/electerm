const axios = require('axios')
const { StringDecoder } = require('string_decoder')
const log = require('../common/log')
const defaultSettings = require('../common/config-default')
const { createProxyAgent } = require('./proxy-agent')

// Store for ongoing streaming sessions
const streamingSessions = new Map()

// Stop an ongoing streaming session
exports.stopStream = (sessionId) => {
  const session = streamingSessions.get(sessionId)
  if (!session) {
    return { error: 'Session not found' }
  }

  // Destroy the stream to stop receiving data
  if (session.stream && !session.stream.destroyed) {
    session.stream.destroy()
  }

  // Mark as completed (not an error, just stopped by user)
  session.completed = true
  session.stopped = true

  // Clean up
  streamingSessions.delete(sessionId)

  return { stopped: true }
}

const createAIClient = (baseURL, apiKey, proxy, authHeaderName) => {
  const headerStr = authHeaderName || 'Authorization: Bearer'
  const parts = headerStr.split(': ')
  const headerKey = parts[0]
  const headerPrefix = parts.length > 1 ? parts[1] : ''
  const headerValue = headerPrefix
    ? `${headerPrefix} ${apiKey}`
    : apiKey
  const config = {
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      [headerKey]: headerValue
    }
  }

  // Add proxy agent if proxy is provided
  const agent = proxy ? createProxyAgent(proxy) : null
  if (agent) {
    config.httpsAgent = agent
    config.proxy = false // Disable default proxy behavior when using agent
  }

  return axios.create(config)
}

exports.AIchatWithTools = async (messages, model, baseURL, path, apiKey, proxy, tools, authHeaderName) => {
  try {
    const client = createAIClient(baseURL, apiKey, proxy, authHeaderName)
    const requestData = {
      model,
      messages,
      stream: false
    }
    if (tools && tools.length) {
      requestData.tools = tools
    }
    const response = await client.post(path, requestData)
    const choice = response.data.choices[0]
    return {
      message: choice.message
    }
  } catch (e) {
    log.error('AI chat with tools error', e)
    return { error: e.message }
  }
}

exports.AIchat = async (
  prompt,
  model = defaultSettings.modelAI,
  role = defaultSettings.roleAI,
  baseURL = defaultSettings.baseURLAI,
  path = defaultSettings.apiPathAI,
  apiKey,
  proxy = defaultSettings.proxyAI,
  stream = true,
  authHeaderName = defaultSettings.authHeaderNameAI,
  messages = null
) => {
  try {
    const client = createAIClient(baseURL, apiKey, proxy, authHeaderName)

    // Determine if we should use streaming based on the prompt content
    // Command suggestions should not use streaming for quick response
    const isCommandSuggestion = prompt.includes('give me max 5 command suggestions')
    const useStream = stream && !isCommandSuggestion

    // Use provided conversation messages if available, otherwise build from prompt and role
    const requestMessages = messages || [
      {
        role: 'system',
        content: role
      },
      {
        role: 'user',
        content: prompt
      }
    ]

    const requestData = {
      model,
      messages: requestMessages,
      stream: useStream
    }

    if (useStream) {
      // For streaming responses, initiate streaming and return session info
      const response = await client.post(path, requestData, {
        responseType: 'stream'
      })

      const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const sessionData = {
        stream: response.data,
        content: '',
        completed: false,
        error: null
      }

      streamingSessions.set(sessionId, sessionData)

      // Start processing the stream
      processStream(sessionId, sessionData)

      return {
        sessionId,
        isStream: true,
        hasMore: true,
        content: ''
      }
    } else {
      // For non-streaming responses (command suggestions and when stream=false)
      const response = await client.post(path, requestData)

      return {
        response: response.data.choices[0].message.content,
        isStream: false
      }
    }
  } catch (e) {
    log.error('AI chat error')
    log.error(e)
    return {
      error: e.message,
      stack: e.stack
    }
  }
}

// Function to get the current state of a streaming session
exports.getStreamContent = (sessionId) => {
  const session = streamingSessions.get(sessionId)
  if (!session) {
    return {
      error: 'Session not found'
    }
  }

  const result = {
    content: session.content,
    hasMore: !session.completed,
    isStream: true
  }

  if (session.error) {
    result.error = session.error
  }

  // Clean up completed sessions
  if (session.completed || session.error) {
    streamingSessions.delete(sessionId)
  }

  return result
}

// Process streaming data
function processStream (sessionId, sessionData) {
  let buffer = ''
  const decoder = new StringDecoder('utf8')

  const processLines = (shouldFlush = false) => {
    const lines = buffer.split('\n')
    buffer = shouldFlush ? '' : lines.pop()
    const linesToProcess = shouldFlush ? lines.filter(Boolean).concat(buffer ? [buffer] : []) : lines

    for (const line of linesToProcess) {
      if (line.trim() === '') continue
      if (line.trim() === 'data: [DONE]') {
        sessionData.completed = true
        return
      }

      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
            sessionData.content += data.choices[0].delta.content
          }
        } catch (e) {
          log.error('Error parsing stream data:', e)
        }
      }
    }
  }

  sessionData.stream.on('data', (chunk) => {
    buffer += decoder.write(chunk)
    processLines()
  })

  sessionData.stream.on('end', () => {
    buffer += decoder.end()
    processLines(true)
    sessionData.completed = true
  })

  sessionData.stream.on('error', (error) => {
    sessionData.error = error.message
    sessionData.completed = true
  })
}
