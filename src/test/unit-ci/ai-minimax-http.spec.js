const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const axios = require('axios')

// Keep Electron logging out of these plain Node HTTP tests.
const logPath = require.resolve('../../app/common/log')
require.cache[logPath] = {
  id: logPath,
  filename: logPath,
  loaded: true,
  exports: {
    error () {},
    info () {},
    warn () {},
    debug () {}
  }
}
const { AIchat, AIchatWithTools, getStreamContent } = require('../../app/lib/ai')
let server
let localURL
let configuredURL
let captured
const originalAdapter = axios.defaults.adapter

before(async () => {
  server = http.createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    captured = { url: req.url, headers: req.headers, body: JSON.parse(raw) }
    if (captured.body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.end('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n')
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }))
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  localURL = `http://127.0.0.1:${server.address().port}/v1`
  const adapter = axios.getAdapter('http')
  // Intercept only the destination: real axios serialization and HTTP still run.
  axios.defaults.adapter = config => {
    configuredURL = config.baseURL
    return adapter({ ...config, baseURL: localURL, proxy: false })
  }
})

after(async () => {
  axios.defaults.adapter = originalAdapter
  await new Promise(resolve => server.close(resolve))
})

describe('MiniMax preset requests', () => {
  for (const region of ['global', 'cn']) {
    for (const selected of [null, 'MiniMax-M3', 'MiniMax-M2.7', 'custom-model']) {
      it(`sends ${region} ${selected || 'preset default'} unchanged`, async () => {
        const { defaultAIPresets } = await import('../../client/components/ai/ai-presets.js')
        const preset = defaultAIPresets.find(p => p.id === `minimax-${region}`)
        const model = selected || preset.modelAI
        const result = await AIchat('hello', model, 'system', preset.baseURLAI,
          preset.apiPathAI, 'fixture-key', '', false, preset.authHeaderNameAI)
        assert.equal(result.response, 'ok')
        assert.equal(configuredURL, preset.baseURLAI)
        assert.equal(captured.url, '/v1/chat/completions')
        assert.equal(captured.headers.authorization, 'Bearer fixture-key')
        assert.deepEqual(captured.body, {
          model,
          messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'hello' }],
          stream: false
        })
      })
    }
  }

  it('preserves tool history, reasoning and image content', async () => {
    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,fixture' } }] },
      { role: 'assistant', content: '', reasoning_content: 'saved reasoning', tool_calls: [{ id: 'call1', type: 'function', function: { name: 'lookup', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'call1', content: 'saved result' }
    ]
    const tools = [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: {} } } }]
    const result = await AIchatWithTools(messages, 'MiniMax-M3.1-Flash',
      'https://api.minimax.io/v1', '/chat/completions', 'fixture-key', '', tools, 'Authorization: Bearer')
    assert.equal(result.message.content, 'ok')
    assert.deepEqual(captured.body.messages, messages)
    assert.deepEqual(captured.body.tools, tools)
    for (const key of ['thinking', 'reasoning_effort', 'service_tier', 'reasoning_split']) {
      assert.equal(key in captured.body, false)
    }
  })

  it('streams Flash responses through the normal chat path', async () => {
    const result = await AIchat('hello', 'MiniMax-M3.1-Flash', 'system',
      'https://api.minimax.io/v1', '/chat/completions', 'fixture-key', '', true, 'Authorization: Bearer')
    assert.equal(result.isStream, true)
    assert.equal(captured.body.stream, true)
    for (let i = 0; i < 100; i++) {
      const response = getStreamContent(result.sessionId)
      if (!response.hasMore) {
        assert.equal(response.content, 'ok')
        assert.equal(response.error, undefined)
        return
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    assert.fail('stream did not finish')
  })
})
