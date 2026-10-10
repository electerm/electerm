const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createSubscriptionProvider } = require('../../app/lib/ai-subscription-provider')

function readable (events) {
  const { Readable } = require('node:stream')
  return Readable.from(events.map(item => `event: ${item.type}\ndata: ${JSON.stringify(item)}\n\n`))
}

describe('subscription Responses transport', () => {
  it('pins endpoint, bearer token, stream, and storage policy; parses completed text', async () => {
    let request
    const http = {
      async post (url, body, options) {
        request = { url, body, options }
        return {
          data: readable([
            { type: 'response.output_text.delta', delta: 'Hello' },
            { type: 'response.completed', response: { usage: { input_tokens: 3, output_tokens: 2 } } }
          ])
        }
      }
    }
    const provider = createSubscriptionProvider({ http, getAccessToken: async () => 'subscription-secret' })
    const result = await provider.chat({ providerAI: 'chatgpt', messages: [{ role: 'user', content: 'hi' }], model: 'gpt-test' })
    assert.equal(request.url, 'https://api.openai.com/v1/responses')
    assert.equal(request.options.headers.Authorization, 'Bearer subscription-secret')
    assert.equal(request.body.stream, true)
    assert.equal(request.body.store, false)
    assert.equal(request.body.input[0].content, 'hi')
    assert.equal('baseURL' in request.body, false)
    assert.equal('apiKey' in request.body, false)
    assert.equal('system' in request.body, false)
    assert.equal(result.message.content, 'Hello')
    assert.equal(result.usage.totalTokens, 5)
  })

  it('rejects a stream that closes before response.completed', async () => {
    const http = { async post () { return { data: readable([{ type: 'response.output_text.delta', delta: 'partial' }]) } } }
    const provider = createSubscriptionProvider({ http, getAccessToken: async () => 'secret' })
    const result = await provider.chat({ providerAI: 'supergrok', messages: [], model: 'grok-test' })
    assert.match(result.error, /completed/i)
  })

  it('normalizes streamed function calls for the agent loop', async () => {
    const http = {
      async post () {
        return {
          data: readable([
            { type: 'response.output_item.added', item: { type: 'function_call', id: 'item-1', call_id: 'call-1', name: 'run_command', arguments: '' } },
            { type: 'response.function_call_arguments.delta', item_id: 'item-1', delta: '{"cmd":"pwd"}' },
            { type: 'response.completed', response: { status: 'completed' } }
          ])
        }
      }
    }
    const provider = createSubscriptionProvider({ http, getAccessToken: async () => 'secret' })
    const result = await provider.chat({ providerAI: 'chatgpt', messages: [], model: 'gpt-test', tools: [] })
    assert.deepEqual(result.message.tool_calls, [{
      id: 'call-1',
      type: 'function',
      function: { name: 'run_command', arguments: '{"cmd":"pwd"}' }
    }])
  })

  it('aborts only the stream owned by the matching request id', async () => {
    let signal
    const http = {
      async post (url, body, options) {
        signal = options.signal
        return {
          data: (async function * () {
            await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
            throw new Error('socket aborted')
          })()
        }
      }
    }
    const provider = createSubscriptionProvider({ http, getAccessToken: async () => 'token' })
    const pending = provider.chat({ providerAI: 'chatgpt', messages: [], model: 'gpt-test', requestId: 'request-a' })
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(provider.abort('request-b'), { error: 'Request not found' })
    assert.deepEqual(provider.abort('request-a'), { aborted: true })
    assert.equal(signal.aborted, true)
    assert.deepEqual(await pending, { aborted: true })
  })
})
