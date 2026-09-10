const axios = require('axios')
const { StringDecoder } = require('string_decoder')
const log = require('../common/log')
const defaultSettings = require('../common/config-default')
const { createProxyAgent } = require('./proxy-agent')
const { errorMessageFromData } = require('./ai-response')
const {
  detectFormat,
  headersForFormat,
  buildRequest,
  parseResponse,
  createStreamParser
} = require('./ai-format')

// Keep the real error detail, axios only reports the status code
const formatError = (e) => {
  const detail = errorMessageFromData(e.response && e.response.data)
  return detail ? `${e.message}: ${detail}` : e.message
}

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

const createAIClient = (baseURL, apiKey, proxy, authHeaderName, extraHeaders) => {
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
      [headerKey]: headerValue,
      ...(extraHeaders || {})
    }
  }

  // Add proxy agent if proxy is provided
  const agent = proxy ? createProxyAgent(proxy) : null
  if (agent) {
    config.httpAgent = agent
    config.httpsAgent = agent
    config.proxy = false // Disable default proxy behavior when using agent
  }

  return axios.create(config)
}

// Standard `/models` listing, used by the AI config form reload button.
// Providers answer in several shapes, so normalize whatever we get to a string list.
function extractModelList (data) {
  const arr = Array.isArray(data)
    ? data
    : data && Array.isArray(data.data)
      ? data.data
      : data && Array.isArray(data.models)
        ? data.models
        : []
  const seen = new Set()
  const models = []
  for (const item of arr) {
    const id = typeof item === 'string'
      ? item
      : item && (item.id || item.name || item.model)
    if (id && !seen.has(id)) {
      seen.add(id)
      models.push(id)
    }
  }
  return models
}

exports.AIlistModels = async (baseURL, apiKey, authHeaderName, proxy) => {
  try {
    // Anthropic's /models needs the version header, other providers ignore it
    const extraHeaders = /x-api-key/i.test(authHeaderName || '')
      ? { 'anthropic-version': '2023-06-01' }
      : null
    const client = createAIClient(baseURL, apiKey, proxy, authHeaderName, extraHeaders)
    const url = baseURL.replace(/\/+$/, '') + '/models'
    const response = await client.get(url)
    const models = extractModelList(response.data)
    if (!models.length) {
      return { error: 'No models found in response' }
    }
    return { models }
  } catch (e) {
    log.error('AI list models error', e)
    return { error: formatError(e) }
  }
}

exports.AIchatWithTools = async (messages, model, baseURL, path, apiKey, proxy, tools, authHeaderName, format) => {
  try {
    const fmt = detectFormat(path, format)
    const client = createAIClient(baseURL, apiKey, proxy, authHeaderName, headersForFormat(fmt))
    const requestData = buildRequest(fmt, {
      model,
      messages,
      tools,
      stream: false
    })
    const response = await client.post(path, requestData)
    const { message, error } = parseResponse(fmt, response.data)
    if (error) {
      return { error }
    }
    return { message }
  } catch (e) {
    log.error('AI chat with tools error', e)
    return { error: formatError(e) }
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
  messages = null,
  format
) => {
  try {
    const fmt = detectFormat(path, format)
    const client = createAIClient(baseURL, apiKey, proxy, authHeaderName, headersForFormat(fmt))

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

    const requestData = buildRequest(fmt, {
      model,
      messages: requestMessages,
      stream: useStream
    })

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
      processStream(sessionId, sessionData, fmt)

      return {
        sessionId,
        isStream: true,
        hasMore: true,
        content: ''
      }
    } else {
      // For non-streaming responses (command suggestions and when stream=false)
      const response = await client.post(path, requestData)
      const { message, error } = parseResponse(fmt, response.data)
      if (error) {
        return { error }
      }

      return {
        response: message.content === undefined ? '' : message.content,
        isStream: false
      }
    }
  } catch (e) {
    log.error('AI chat error')
    log.error(e)
    return {
      error: formatError(e),
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

// Process streaming data. `format` picks the SSE parser (openai-chat /
// openai-responses / anthropic) and normalizes all of them to plain content.
function processStream (sessionId, sessionData, format) {
  const decoder = new StringDecoder('utf8')
  const parser = createStreamParser(format)

  const sync = () => {
    sessionData.content = parser.content
    if (parser.error) {
      sessionData.error = parser.error
      sessionData.completed = true
    } else if (parser.completed) {
      sessionData.completed = true
    }
  }

  sessionData.stream.on('data', (chunk) => {
    parser.feed(decoder.write(chunk))
    sync()
  })

  sessionData.stream.on('end', () => {
    parser.feed(decoder.end())
    parser.flush()
    sessionData.content = parser.content
    if (parser.error) {
      sessionData.error = parser.error
    }
    sessionData.completed = true
  })

  sessionData.stream.on('error', (error) => {
    sessionData.error = error.message
    sessionData.completed = true
  })
}
