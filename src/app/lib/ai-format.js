// Protocol layer for the 3 mainstream LLM HTTP APIs:
//   - openai-chat      : POST /chat/completions  (the classic OpenAI compatible shape)
//   - openai-responses : POST /responses         (OpenAI Responses API)
//   - anthropic        : POST /messages          (Claude Messages API)
//
// Everything is normalized to the OpenAI chat-completions `message` shape:
//   { role: 'assistant', content: string|null,
//     tool_calls: [{ id, type: 'function', function: { name, arguments } }] }
// so the upper layers (agent loop / chat) stay protocol agnostic.
//
// Dependency free on purpose so it can be unit tested without electron.

const {
  resolveAIResponse,
  errorMessageFromData,
  stringifyData
} = require('./ai-response')

const FORMAT_OPENAI_CHAT = 'openai-chat'
const FORMAT_OPENAI_RESPONSES = 'openai-responses'
const FORMAT_ANTHROPIC = 'anthropic'

const FORMATS = [
  FORMAT_OPENAI_CHAT,
  FORMAT_OPENAI_RESPONSES,
  FORMAT_ANTHROPIC
]

// Anthropic requires a `max_tokens` and a dated API version header.
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_ANTHROPIC_MAX_TOKENS = 4096

// Detect the wire format from an api path. Explicit `format` wins when valid.
//   /chat/completions -> openai-chat
//   /responses        -> openai-responses
//   /messages         -> anthropic
function detectFormat (path, format) {
  if (FORMATS.includes(format)) {
    return format
  }
  const p = String(path || '').toLowerCase()
  if (p.includes('/responses')) {
    return FORMAT_OPENAI_RESPONSES
  }
  if (p.includes('/messages')) {
    return FORMAT_ANTHROPIC
  }
  return FORMAT_OPENAI_CHAT
}

// Extra headers a protocol needs in addition to the auth header.
function headersForFormat (format) {
  if (format === FORMAT_ANTHROPIC) {
    return { 'anthropic-version': ANTHROPIC_VERSION }
  }
  return {}
}

// Flatten string | array<{text}> content into plain text.
function textFromContent (content) {
  if (content === null || content === undefined) {
    return ''
  }
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    let out = ''
    for (const part of content) {
      if (typeof part === 'string') {
        out += part
      } else if (part && typeof part === 'object') {
        if (typeof part.text === 'string') {
          out += part.text
        } else if (typeof part.content === 'string') {
          out += part.content
        }
      }
    }
    return out
  }
  return String(content)
}

function safeParseJSON (value, fallback) {
  if (typeof value !== 'string') {
    return value === undefined ? fallback : value
  }
  try {
    return JSON.parse(value)
  } catch (e) {
    return fallback
  }
}

function toOpenAIToolCall ({ id, name, arguments: args }) {
  return {
    id: id || '',
    type: 'function',
    function: {
      name: name || '',
      arguments: typeof args === 'string'
        ? args
        : JSON.stringify(args === undefined ? {} : args)
    }
  }
}

/* ------------------------------------------------------------------ *
 * Request building
 * ------------------------------------------------------------------ */

function buildOpenAIChatBody ({ model, messages, tools, stream }) {
  const body = {
    model,
    messages,
    stream: !!stream
  }
  if (tools && tools.length) {
    body.tools = tools
  }
  return body
}

// OpenAI Responses: system prompts go to `instructions`, tools are flattened.
function buildResponsesBody ({ model, messages, tools, stream }) {
  const instructions = []
  const input = []
  for (const m of messages) {
    if (!m || typeof m !== 'object') {
      continue
    }
    const role = m.role
    if (role === 'system' || role === 'developer') {
      const text = textFromContent(m.content)
      if (text) {
        instructions.push(text)
      }
      continue
    }
    if (role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: m.tool_call_id,
        output: textFromContent(m.content)
      })
      continue
    }
    if (role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const text = textFromContent(m.content)
      if (text) {
        input.push({ role: 'assistant', content: text })
      }
      for (const tc of m.tool_calls) {
        const fn = (tc && tc.function) || {}
        input.push({
          type: 'function_call',
          call_id: tc.id,
          name: fn.name,
          arguments: fn.arguments || '{}'
        })
      }
      continue
    }
    input.push({
      role,
      content: textFromContent(m.content)
    })
  }
  const body = {
    model,
    input,
    stream: !!stream
  }
  if (instructions.length) {
    body.instructions = instructions.join('\n\n')
  }
  if (tools && tools.length) {
    body.tools = tools.map(t => {
      const fn = (t && t.function) || t || {}
      const out = {
        type: 'function',
        name: fn.name
      }
      if (fn.description) {
        out.description = fn.description
      }
      if (fn.parameters) {
        out.parameters = fn.parameters
      }
      return out
    })
  }
  return body
}

// Anthropic Messages: system is top level, tool_use / tool_result are content blocks.
function buildAnthropicBody ({ model, messages, tools, stream, maxTokens }) {
  const systemParts = []
  const out = []

  const pushMessage = (role, blocks) => {
    if (!blocks.length) {
      return
    }
    const last = out[out.length - 1]
    if (last && last.role === role) {
      last.content = last.content.concat(blocks)
    } else {
      out.push({ role, content: blocks })
    }
  }

  for (const m of messages) {
    if (!m || typeof m !== 'object') {
      continue
    }
    const role = m.role
    if (role === 'system' || role === 'developer') {
      const text = textFromContent(m.content)
      if (text) {
        systemParts.push(text)
      }
      continue
    }
    if (role === 'tool') {
      pushMessage('user', [{
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: textFromContent(m.content)
      }])
      continue
    }
    if (role === 'assistant') {
      const blocks = []
      const text = textFromContent(m.content)
      if (text) {
        blocks.push({ type: 'text', text })
      }
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          const fn = (tc && tc.function) || {}
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: fn.name,
            input: safeParseJSON(fn.arguments, {})
          })
        }
      }
      pushMessage('assistant', blocks)
      continue
    }
    // user (default)
    pushMessage('user', [{
      type: 'text',
      text: textFromContent(m.content)
    }])
  }

  const body = {
    model,
    messages: out,
    max_tokens: maxTokens || DEFAULT_ANTHROPIC_MAX_TOKENS,
    stream: !!stream
  }
  if (systemParts.length) {
    body.system = systemParts.join('\n\n')
  }
  if (tools && tools.length) {
    body.tools = tools.map(t => {
      const fn = (t && t.function) || t || {}
      const out = {
        name: fn.name,
        description: fn.description || ''
      }
      out.input_schema = fn.parameters || {
        type: 'object',
        properties: {}
      }
      return out
    })
  }
  return body
}

function buildRequest (format, { model, messages, tools, stream, maxTokens } = {}) {
  const msgs = Array.isArray(messages) ? messages : []
  if (format === FORMAT_ANTHROPIC) {
    return buildAnthropicBody({
      model,
      messages: msgs,
      tools,
      stream,
      maxTokens
    })
  }
  if (format === FORMAT_OPENAI_RESPONSES) {
    return buildResponsesBody({
      model,
      messages: msgs,
      tools,
      stream
    })
  }
  return buildOpenAIChatBody({
    model,
    messages: msgs,
    tools,
    stream
  })
}

/* ------------------------------------------------------------------ *
 * Non streaming response parsing
 * ------------------------------------------------------------------ */

function parseResponsesResponse (data) {
  const error = errorMessageFromData(data)
  if (error) {
    return { error }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      error: `Unexpected AI response(no message): ${stringifyData(data)}`
    }
  }
  let text = ''
  const toolCalls = []
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item || typeof item !== 'object') {
        continue
      }
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (
            c &&
            (c.type === 'output_text' || c.type === 'text') &&
            typeof c.text === 'string'
          ) {
            text += c.text
          }
        }
      } else if (item.type === 'function_call') {
        toolCalls.push(toOpenAIToolCall({
          id: item.call_id || item.id,
          name: item.name,
          arguments: item.arguments
        }))
      }
    }
  }
  if (!text && typeof data.output_text === 'string') {
    text = data.output_text
  }
  const message = {
    role: 'assistant',
    content: text || null
  }
  if (toolCalls.length) {
    message.tool_calls = toolCalls
  }
  if (!text && !toolCalls.length) {
    if (data.status === 'incomplete') {
      const reason = data.incomplete_details && data.incomplete_details.reason
      return { error: `AI response incomplete${reason ? `: ${reason}` : ''}` }
    }
    return {
      error: `Unexpected AI response(no message): ${stringifyData(data)}`
    }
  }
  return { message }
}

function parseAnthropicResponse (data) {
  const error = errorMessageFromData(data)
  if (error) {
    return { error }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      error: `Unexpected AI response(no message): ${stringifyData(data)}`
    }
  }
  let text = ''
  const toolCalls = []
  if (typeof data.content === 'string') {
    text = data.content
  } else if (Array.isArray(data.content)) {
    for (const c of data.content) {
      if (!c || typeof c !== 'object') {
        continue
      }
      if (c.type === 'text' && typeof c.text === 'string') {
        text += c.text
      } else if (c.type === 'tool_use') {
        toolCalls.push(toOpenAIToolCall({
          id: c.id,
          name: c.name,
          arguments: c.input
        }))
      }
    }
  }
  const message = {
    role: 'assistant',
    content: text || null
  }
  if (toolCalls.length) {
    message.tool_calls = toolCalls
  }
  if (!text && !toolCalls.length) {
    return {
      error: `Unexpected AI response(no message): ${stringifyData(data)}`
    }
  }
  return { message }
}

/* ------------------------------------------------------------------ *
 * Streaming (SSE) parsing
 * ------------------------------------------------------------------ */

// Creates an incremental SSE parser for the given format.
// feed(text) with decoded chunks, then flush() at the end.
function createStreamParser (format) {
  const state = {
    content: '',
    completed: false,
    error: null
  }
  const toolCalls = new Map()
  let buffer = ''
  let eventName = ''

  const getToolCall = (key, id) => {
    let call = toolCalls.get(key)
    if (!call) {
      call = {
        id: id || '',
        type: 'function',
        function: {
          name: '',
          arguments: ''
        }
      }
      toolCalls.set(key, call)
    } else if (id) {
      call.id = id
    }
    return call
  }

  const setError = (message) => {
    state.error = message || 'Unknown streaming error'
    state.completed = true
  }

  const handleChatChunk = (data) => {
    const choice = data.choices && data.choices[0]
    if (!choice) {
      return
    }
    const delta = choice.delta || {}
    if (typeof delta.content === 'string') {
      state.content += delta.content
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const index = tc.index === undefined ? 0 : tc.index
        const call = getToolCall(`c:${index}`, tc.id)
        if (tc.function) {
          if (tc.function.name) {
            call.function.name += tc.function.name
          }
          if (tc.function.arguments) {
            call.function.arguments += tc.function.arguments
          }
        }
      }
    }
    if (choice.finish_reason) {
      state.completed = true
    }
  }

  const handleAnthropicEvent = (event, data) => {
    const type = data.type || event
    if (type === 'error') {
      setError((data.error && data.error.message) || 'Streaming error')
      return
    }
    if (type === 'content_block_start') {
      const block = data.content_block
      if (block && block.type === 'tool_use') {
        const call = getToolCall(`b:${data.index}`, block.id)
        call.function.name = block.name || call.function.name
        if (block.input && Object.keys(block.input).length) {
          call.function.arguments = JSON.stringify(block.input)
        }
      }
    } else if (type === 'content_block_delta') {
      const delta = data.delta || {}
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        state.content += delta.text
      } else if (
        delta.type === 'input_json_delta' &&
        typeof delta.partial_json === 'string'
      ) {
        const call = getToolCall(`b:${data.index}`)
        call.function.arguments += delta.partial_json
      }
    } else if (type === 'message_stop') {
      state.completed = true
    }
  }

  const handleResponsesEvent = (event, data) => {
    const type = data.type || event
    if (type === 'response.output_text.delta') {
      if (typeof data.delta === 'string') {
        state.content += data.delta
      }
    } else if (type === 'response.output_item.added' ||
      type === 'response.output_item.done') {
      const item = data.item
      if (item && item.type === 'function_call') {
        const call = getToolCall(`o:${item.id || item.call_id}`, item.call_id || item.id)
        if (item.name) {
          call.function.name = item.name
        }
        if (item.arguments) {
          call.function.arguments = item.arguments
        }
      }
    } else if (type === 'response.function_call_arguments.delta') {
      const call = getToolCall(`o:${data.item_id}`)
      if (typeof data.delta === 'string') {
        call.function.arguments += data.delta
      }
    } else if (type === 'response.completed') {
      state.completed = true
    } else if (type === 'response.failed' || type === 'error') {
      const resp = data.response
      const msg = (resp && resp.error && resp.error.message) ||
        (data.error && data.error.message) ||
        'Streaming error'
      setError(msg)
    }
  }

  const handleData = (data) => {
    if (!data || typeof data !== 'object') {
      return
    }
    if (data.choices && data.choices[0]) {
      handleChatChunk(data)
      return
    }
    if (data.error) {
      setError(data.error.message || String(data.error))
      return
    }
    if (format === FORMAT_ANTHROPIC) {
      handleAnthropicEvent(eventName, data)
    } else if (format === FORMAT_OPENAI_RESPONSES) {
      handleResponsesEvent(eventName, data)
    }
  }

  const handleLine = (raw) => {
    const line = raw.trim()
    if (!line) {
      return
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      return
    }
    let payload
    if (line.startsWith('data:')) {
      payload = line.slice(5).trim()
    } else if (line.startsWith('{')) {
      // some relays send raw json lines without the SSE prefix
      payload = line
    } else {
      return
    }
    if (!payload) {
      return
    }
    if (payload === '[DONE]') {
      state.completed = true
      return
    }
    let data
    try {
      data = JSON.parse(payload)
    } catch (e) {
      eventName = ''
      return
    }
    handleData(data)
    eventName = ''
  }

  const processBuffer = (flush) => {
    const lines = buffer.split(/\r?\n/)
    if (flush) {
      buffer = ''
    } else {
      buffer = lines.pop() || ''
    }
    for (const line of lines) {
      handleLine(line)
    }
  }

  return {
    feed (text) {
      if (typeof text !== 'string' || !text) {
        return
      }
      buffer += text
      processBuffer(false)
    },
    flush () {
      processBuffer(true)
    },
    get content () {
      return state.content
    },
    get toolCalls () {
      return Array.from(toolCalls.values())
    },
    get completed () {
      return state.completed
    },
    get error () {
      return state.error
    }
  }
}

function streamResultToMessage (parser) {
  const message = {
    role: 'assistant',
    content: parser.content || null
  }
  const toolCalls = parser.toolCalls
  if (toolCalls.length) {
    message.tool_calls = toolCalls
  }
  return message
}

// Some endpoints ignore `stream: false` and reply with a SSE body anyway.
function parseTextResponse (format, text) {
  if (typeof text !== 'string' || !text.includes('data:')) {
    return {
      error: `Unexpected AI response(no message): ${stringifyData(text)}`
    }
  }
  const parser = createStreamParser(format)
  parser.feed(text)
  parser.flush()
  if (parser.error) {
    return { error: parser.error }
  }
  const message = streamResultToMessage(parser)
  if (!message.content && !message.tool_calls) {
    return {
      error: `Unexpected AI response(no message): ${stringifyData(text)}`
    }
  }
  return { message }
}

// Returns { message } on success, { error } otherwise.
function parseResponse (format, data) {
  if (format === FORMAT_ANTHROPIC) {
    if (typeof data === 'string') {
      return parseTextResponse(format, data)
    }
    return parseAnthropicResponse(data)
  }
  if (format === FORMAT_OPENAI_RESPONSES) {
    if (typeof data === 'string') {
      return parseTextResponse(format, data)
    }
    return parseResponsesResponse(data)
  }
  // openai chat handles both json and (mistakenly) streamed text bodies
  return resolveAIResponse(data)
}

exports.detectFormat = detectFormat
exports.headersForFormat = headersForFormat
exports.buildRequest = buildRequest
exports.parseResponse = parseResponse
exports.createStreamParser = createStreamParser
exports.streamResultToMessage = streamResultToMessage
exports.textFromContent = textFromContent
exports.toOpenAIToolCall = toOpenAIToolCall
exports.FORMAT_OPENAI_CHAT = FORMAT_OPENAI_CHAT
exports.FORMAT_OPENAI_RESPONSES = FORMAT_OPENAI_RESPONSES
exports.FORMAT_ANTHROPIC = FORMAT_ANTHROPIC
exports.FORMATS = FORMATS
