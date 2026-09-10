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

// Returns { message } on success, { error } otherwise
exports.resolveAIResponse = (data) => {
  const error = errorMessageFromData(data)
  if (error) {
    return { error }
  }
  const choice = data && data.choices && data.choices[0]
  if (choice && choice.message) {
    return { message: choice.message }
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
