const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  resolveAIResponse,
  errorMessageFromData,
  stringifyData
} = require('../../../src/app/lib/ai-response')

describe('resolveAIResponse', () => {
  it('returns message for a normal openai response', () => {
    const res = resolveAIResponse({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'hello'
          }
        }
      ]
    })
    assert.deepEqual(res, {
      message: {
        role: 'assistant',
        content: 'hello'
      }
    })
  })

  it('keeps tool_calls of assistant message', () => {
    const message = {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'run_command',
            arguments: '{}'
          }
        }
      ]
    }
    const res = resolveAIResponse({ choices: [{ message }] })
    assert.equal(res.message.tool_calls[0].function.name, 'run_command')
  })

  it('reports string error body instead of crashing', () => {
    const res = resolveAIResponse({ error: 'Invalid or expired API key' })
    assert.deepEqual(res, { error: 'Invalid or expired API key' })
  })

  it('reports nested error object', () => {
    const res = resolveAIResponse({
      error: {
        message: 'invalid model',
        type: 'invalid_request_error'
      }
    })
    assert.equal(res.error, 'invalid model')
  })

  it('reports code/message style error body', () => {
    const res = resolveAIResponse({
      code: 401,
      message: 'no permission'
    })
    assert.equal(res.error, 'no permission')
  })

  it('does not treat a valid message-only response as error', () => {
    const res = resolveAIResponse({
      choices: [{ message: { content: 'ok' } }],
      message: 'some extra field'
    })
    assert.equal(res.message.content, 'ok')
  })

  it('parses SSE body when endpoint ignores stream:false', () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"he"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"llo"}}]}',
      '',
      'data: [DONE]',
      ''
    ].join('\n')
    const res = resolveAIResponse(body)
    assert.deepEqual(res.message, {
      role: 'assistant',
      content: 'hello'
    })
  })

  it('ignores malformed SSE lines', () => {
    const body = 'data: not-json\ndata: {"choices":[{"delta":{"content":"a"}}]}\n'
    const res = resolveAIResponse(body)
    assert.equal(res.message.content, 'a')
  })

  it('errors on empty choices array', () => {
    const res = resolveAIResponse({ choices: [] })
    assert.match(res.error, /^Unexpected AI response\(no message\)/)
  })

  it('errors on choice without message', () => {
    const res = resolveAIResponse({
      choices: [{ finish_reason: 'stop' }]
    })
    assert.match(res.error, /^Unexpected AI response\(no message\)/)
  })

  it('errors on null/undefined body', () => {
    assert.match(resolveAIResponse(null).error, /no message/)
    assert.match(resolveAIResponse(undefined).error, /no message/)
  })

  it('errors on html error page from gateway', () => {
    const res = resolveAIResponse('<html><body>404 Not Found</body></html>')
    assert.match(res.error, /404 Not Found/)
  })

  it('truncates long raw body in error message', () => {
    const res = resolveAIResponse('x'.repeat(1000))
    assert.ok(res.error.length < 400)
  })
})

describe('errorMessageFromData', () => {
  it('returns empty for non error bodies', () => {
    assert.equal(errorMessageFromData(null), '')
    assert.equal(errorMessageFromData('plain text'), '')
    assert.equal(errorMessageFromData({ choices: [{}] }), '')
    assert.equal(errorMessageFromData({ foo: 'bar' }), '')
    assert.equal(errorMessageFromData([1, 2, 3]), '')
  })

  it('supports Error key', () => {
    assert.equal(errorMessageFromData({ Error: 'boom' }), 'boom')
  })
})

describe('stringifyData', () => {
  it('handles circular object without throwing', () => {
    const o = {}
    o.self = o
    assert.equal(typeof stringifyData(o), 'string')
  })
})
