// Normalize AI(OpenAI compatible) response body.
// Some endpoints/proxies return 2xx with an error body, or ignore `stream: false`
// and return a SSE body anyway, which used to make caller crash on `choices[0]`.
// Keep it dependency free so it can be unit tested.

const MAX_RAW_LENGTH = 300

function stringifyData (data) {
  if (data === undefined || data === null) {
    return String(data)
  }
  if (typeof data === 'string') {
    return data.slice(0, MAX_RAW_LENGTH)
  }
  try {
    return JSON.stringify(data).slice(0, MAX_RAW_LENGTH)
  } catch (e) {
    return String(data)
  }
}

// Extract error message from a (usually 2xx) response body
function errorMessageFromData (data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ''
  }
  const err = data.error || data.Error
  if (err) {
    if (typeof err === 'string') {
      return err
    }
    return err.message || stringifyData(err)
  }
  // e.g. { code: 401, message: 'invalid api key' }
  if (!data.choices && data.message) {
    return String(data.message)
  }
  return ''
}

// Some endpoints ignore `stream: false` and reply with a SSE body anyway
function contentFromSSEText (text) {
  if (typeof text !== 'string' || !text.includes('data:')) {
    return ''
  }
  let content = ''
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) {
      continue
    }
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') {
      continue
    }
    try {
      const data = JSON.parse(payload)
      const choice = data.choices && data.choices[0]
      if (choice && choice.delta && choice.delta.content) {
        content += choice.delta.content
      }
    } catch (e) {
      // ignore malformed stream line
    }
  }
  return content
}

// Some providers leave their own markers after the object
// ('{"cmd":"ls"}</think><|...|>'), so the string as a whole does not parse
// even though the call is complete. Take the first complete JSON value:
// a reply cut off inside the object has none, which is the case to refuse.
function firstJsonValue (text) {
  const start = text.search(/[{[]/)
  if (start < 0) {
    return undefined
  }
  const stack = []
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{' || ch === '[') {
      stack.push(ch)
    } else if (ch === '}' || ch === ']') {
      stack.pop()
      if (!stack.length) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch (e) {
          return undefined
        }
      }
    }
  }
  return undefined
}

// Returns { ok, value, recovered }. `ok` is false only when no complete JSON
// value exists, which is what a tool call cut off mid argument looks like.
function parseToolArguments (args) {
  if (typeof args !== 'string' || !args) {
    return { ok: true, value: {} }
  }
  try {
    return { ok: true, value: JSON.parse(args) }
  } catch (e) {
    const value = firstJsonValue(args)
    if (value === undefined) {
      return { ok: false }
    }
    return { ok: true, value, recovered: true }
  }
}

// A tool call whose argument string is not valid JSON was cut off in flight.
// The agent parses `arguments` before running a tool, so an unparsable string
// would run it with `{}` instead of the input the model meant to send.
function toolArgumentsComplete (toolCalls) {
  return toolCalls.every((call) => {
    return parseToolArguments(call && call.function && call.function.arguments).ok
  })
}

// Rewrite the arguments of a recovered call to plain JSON, so the caller can
// parse it without knowing about the provider's trailing markers.
function normalizeToolArguments (toolCalls) {
  return toolCalls.map((call) => {
    const parsed = parseToolArguments(call && call.function && call.function.arguments)
    if (!parsed.recovered) {
      return call
    }
    return {
      ...call,
      function: {
        ...call.function,
        arguments: JSON.stringify(parsed.value)
      }
    }
  })
}

// Returns { message } on success, { error } otherwise
exports.resolveAIResponse = (data) => {
  const error = errorMessageFromData(data)
  if (error) {
    return { error }
  }
  const choice = data && data.choices && data.choices[0]
  if (choice && choice.message) {
    const message = choice.message
    const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
    const toolCalls = normalizeToolArguments(rawCalls)
    if (rawCalls.length) {
      // finish_reason 'length' means the provider stopped at the token limit,
      // so anything after it -- the tool input included -- may be missing.
      if (choice.finish_reason === 'length') {
        return { error: 'AI response truncated (length)' }
      }
      if (!toolArgumentsComplete(toolCalls)) {
        return { error: 'AI response truncated (incomplete tool call)' }
      }
      return { message: { ...message, tool_calls: toolCalls } }
    }
    return { message }
  }
  const streamed = contentFromSSEText(data)
  if (streamed) {
    return {
      message: {
        role: 'assistant',
        content: streamed
      }
    }
  }
  return {
    error: `Unexpected AI response(no message): ${stringifyData(data)}`
  }
}

exports.errorMessageFromData = errorMessageFromData
exports.stringifyData = stringifyData
exports.toolArgumentsComplete = toolArgumentsComplete
exports.normalizeToolArguments = normalizeToolArguments
exports.parseToolArguments = parseToolArguments
