// End to end tests for src/app/lib/ai.js against mock HTTP servers.
// Confirms the real axios wiring works for all 3 protocols:
//   openai-chat (/chat/completions), openai-responses (/responses), anthropic (/messages)
// including request shaping, auth headers and streaming.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

// ai.js pulls in ../common/log -> runtime-constants which needs an electron
// style package.json layout. Stub the logger so it can load under plain node.
const logPath = require.resolve('../../../src/app/common/log')
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

const {
  AIchat,
  AIchatWithTools,
  AIlistModels,
  getStreamContent
} = require('../../../src/app/lib/ai')

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'run a command',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string' }
        }
      }
    }
  }
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// captured requests per path
const captured = []

function readBody (req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

async function writeSse (res, chunks, delay = 15) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  })
  for (const chunk of chunks) {
    res.write(chunk)
    await sleep(delay)
  }
  res.end()
}

let server
let port

before(async () => {
  server = http.createServer(async (req, res) => {
    const body = await readBody(req)
    captured.push({ url: req.url, headers: req.headers, body })
    const json = data => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }

    if (req.url === '/chat/completions') {
      // DeepSeek V4 thinking mode: every replayed assistant turn needs a
      // reasoning_content, with or without tools in the request.
      if (/deepseek/.test(body.model || '')) {
        const missing = body.messages.some(m =>
          m.role === 'assistant' && typeof m.reasoning_content !== 'string'
        )
        if (missing) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({
            error: { message: 'The reasoning_content in the thinking mode must be passed back to the API.' }
          }))
        }
        return json({
          choices: [{ message: { role: 'assistant', content: 'ok', reasoning_content: 'r' } }]
        })
      }
      if (body.model === 'thinking-test') {
        const missingReasoning = body.messages.some(m =>
          m.role === 'assistant' && typeof m.reasoning_content !== 'string'
        )
        if (body.tools && missingReasoning) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({
            error: { message: 'The reasoning_content in the thinking mode must be passed back to the API.' }
          }))
        }
        const toolResult = body.messages.find(m => m.role === 'tool')
        return json({
          choices: [{
            message: toolResult
              ? { role: 'assistant', content: 'done', reasoning_content: 'The tool finished.' }
              : {
                  role: 'assistant',
                  content: null,
                  reasoning_content: 'Check the current directory.',
                  tool_calls: [{
                    id: 'thinking-call',
                    type: 'function',
                    function: { name: 'run_command', arguments: '{"cmd":"pwd"}' }
                  }]
                }
          }]
        })
      }
      if (body.stream) {
        return writeSse(res, [
          'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
          'data: [DONE]\n\n'
        ])
      }
      return json({
        choices: [{
          message: { role: 'assistant', content: 'chat-ok' }
        }]
      })
    }

    if (req.url === '/responses') {
      if (body.stream) {
        return writeSse(res, [
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello "}\n\n',
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"world"}\n\n',
          'event: response.completed\ndata: {"type":"response.completed"}\n\n'
        ])
      }
      return json({
        id: 'resp_1',
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'responses-ok' }]
          }
        ]
      })
    }

    if (req.url === '/models') {
      return json({
        object: 'list',
        data: [
          { id: 'deepseek-chat', object: 'model' },
          { id: 'deepseek-reasoner', object: 'model' },
          { id: 'deepseek-chat', object: 'model' }
        ]
      })
    }

    if (req.url === '/alt/models') {
      return json({ models: [{ name: 'model-a' }, { name: 'model-b' }] })
    }

    if (req.url === '/messages') {
      if (body.stream) {
        return writeSse(res, [
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        ])
      }
      return json({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'anthropic-ok' }]
      })
    }

    res.writeHead(404)
    res.end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
})

after(() => {
  server.close()
})

const baseURL = () => `http://127.0.0.1:${port}`

function lastRequest (url) {
  return [...captured].reverse().find(r => r.url === url)
}

async function collectStream (sessionId) {
  const start = Date.now()
  for (;;) {
    const res = getStreamContent(sessionId)
    if (res.error) {
      throw new Error(res.error)
    }
    if (!res.hasMore) {
      return res.content
    }
    if (Date.now() - start > 4000) {
      throw new Error('stream timeout')
    }
    await sleep(10)
  }
}

describe('AIchatWithTools - non streaming', () => {
  it('resumes a compressed thinking conversation and preserves reasoning through a tool round trip', async () => {
    const { applySummary } = await import('../../../src/client/components/ai/ai-auto-compress.js')
    const { buildSessionMessages } = await import('../../../src/client/components/ai/ai-context.js')
    const live = [
      { role: 'system', content: 'agent instructions' },
      { role: 'user', content: 'check the directory' },
      { role: 'assistant', content: 'checking', reasoning_content: 'Inspect the directory.' }
    ]
    applySummary(live, 'Continue checking the directory.')
    const restored = buildSessionMessages({
      history: [{
        id: 'summary',
        chatSessionId: 'session',
        timestamp: 1,
        compressed: true,
        response: 'Continue checking the directory.'
      }],
      chatSessionId: 'session',
      role: 'agent instructions'
    })
    const send = messages => AIchatWithTools(
      messages, 'thinking-test', baseURL(), '/chat/completions',
      'sk-test', '', TOOLS, 'Authorization: Bearer'
    )

    for (const messages of [live, restored]) {
      const first = await send(messages)
      assert.equal(first.error, undefined)
      assert.equal(first.message.reasoning_content, 'Check the current directory.')
      assert.equal(first.message.tool_calls[0].id, 'thinking-call')
      messages.push(first.message, {
        role: 'tool', tool_call_id: 'thinking-call', content: '/tmp'
      })
      const second = await send(messages)
      assert.equal(second.error, undefined)
      assert.equal(second.message.content, 'done')
      assert.equal(lastRequest('/chat/completions').body.messages[2].reasoning_content,
        'Check the current directory.')
    }
  })

  it('replays a saved assistant turn with a reasoning placeholder for deepseek models', async () => {
    // What a resumed conversation looks like: buildSessionMessages rebuilds
    // assistant turns from the saved text only, so nothing carries reasoning.
    const messages = [
      { role: 'system', content: 'agent instructions' },
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'second question' }
    ]
    const res = await AIchatWithTools(
      messages, 'deepseek-v4-flash', baseURL(), '/chat/completions',
      'sk-test', '', TOOLS, 'Authorization: Bearer'
    )
    assert.equal(res.error, undefined)
    assert.equal(lastRequest('/chat/completions').body.messages[2].reasoning_content, '')
    // the caller's list (memoized by the component) is left alone
    assert.equal(messages[2].reasoning_content, undefined)
  })

  it('does not add reasoning_content for providers that do not need it', async () => {
    const messages = [
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'second question' }
    ]
    await AIchatWithTools(
      messages, 'gpt-4o', baseURL(), '/chat/completions',
      'sk-test', '', TOOLS, 'Authorization: Bearer'
    )
    assert.equal(lastRequest('/chat/completions').body.messages[1].reasoning_content, undefined)
  })

  it('openai chat completion', async () => {
    const res = await AIchatWithTools(
      [{ role: 'user', content: 'hi' }],
      'gpt-4o',
      baseURL(),
      '/chat/completions',
      'sk-test',
      '',
      TOOLS,
      'Authorization: Bearer'
    )
    assert.equal(res.error, undefined)
    assert.equal(res.message.content, 'chat-ok')
    const req = lastRequest('/chat/completions')
    assert.equal(req.headers.authorization, 'Bearer sk-test')
    assert.equal(req.body.model, 'gpt-4o')
    assert.equal(req.body.stream, false)
    assert.equal(req.body.messages[0].content, 'hi')
    assert.deepEqual(req.body.tools, TOOLS)
  })

  it('openai responses api', async () => {
    const res = await AIchatWithTools(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' }
      ],
      'gpt-4o',
      baseURL(),
      '/responses',
      'sk-test',
      '',
      TOOLS,
      'Authorization: Bearer'
    )
    assert.equal(res.error, undefined)
    assert.equal(res.message.content, 'responses-ok')
    const req = lastRequest('/responses')
    assert.equal(req.body.model, 'gpt-4o')
    assert.equal(req.body.instructions, 'sys')
    assert.deepEqual(req.body.input, [{ role: 'user', content: 'hi' }])
    assert.deepEqual(req.body.tools, [
      {
        type: 'function',
        name: 'run_command',
        description: 'run a command',
        parameters: {
          type: 'object',
          properties: { cmd: { type: 'string' } }
        }
      }
    ])
    // responses api has no nested `function` object
    assert.equal('function' in req.body.tools[0], false)
  })

  it('anthropic messages api', async () => {
    const res = await AIchatWithTools(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' }
      ],
      'claude-sonnet-4-5',
      baseURL(),
      '/messages',
      'sk-ant-test',
      '',
      TOOLS,
      'x-api-key'
    )
    assert.equal(res.error, undefined)
    assert.equal(res.message.content, 'anthropic-ok')
    const req = lastRequest('/messages')
    assert.equal(req.headers['x-api-key'], 'sk-ant-test')
    assert.equal(req.headers['anthropic-version'], '2023-06-01')
    assert.equal(req.body.model, 'claude-sonnet-4-5')
    assert.equal(req.body.system, 'sys')
    assert.equal(req.body.max_tokens, 4096)
    assert.deepEqual(req.body.messages, [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] }
    ])
    assert.deepEqual(req.body.tools, [
      {
        name: 'run_command',
        description: 'run a command',
        input_schema: {
          type: 'object',
          properties: { cmd: { type: 'string' } }
        }
      }
    ])
  })
})

describe('AIchat - non streaming', () => {
  it('parses chat completion text', async () => {
    const res = await AIchat(
      'hello',
      'gpt-4o',
      'role',
      baseURL(),
      '/chat/completions',
      'sk-test',
      '',
      false,
      'Authorization: Bearer'
    )
    assert.equal(res.error, undefined)
    assert.equal(res.response, 'chat-ok')
    assert.equal(res.isStream, false)
  })

  it('parses responses text', async () => {
    const res = await AIchat(
      'hello',
      'gpt-4o',
      'role',
      baseURL(),
      '/responses',
      'sk-test',
      '',
      false,
      'Authorization: Bearer'
    )
    assert.equal(res.response, 'responses-ok')
    const req = lastRequest('/responses')
    // system role goes to instructions on the wire
    assert.equal(req.body.instructions, 'role')
    assert.deepEqual(req.body.input, [{ role: 'user', content: 'hello' }])
  })

  it('parses anthropic text', async () => {
    const res = await AIchat(
      'hello',
      'claude-sonnet-4-5',
      'role',
      baseURL(),
      '/messages',
      'sk-ant',
      '',
      false,
      'x-api-key'
    )
    assert.equal(res.response, 'anthropic-ok')
  })
})

describe('AIchat - streaming', () => {
  it('streams chat completions', async () => {
    const res = await AIchat(
      'hello',
      'gpt-4o',
      'role',
      baseURL(),
      '/chat/completions',
      'sk-test',
      '',
      true,
      'Authorization: Bearer'
    )
    assert.equal(res.isStream, true)
    const content = await collectStream(res.sessionId)
    assert.equal(content, 'Hello world')
    assert.equal(lastRequest('/chat/completions').body.stream, true)
  })

  it('streams responses api', async () => {
    const res = await AIchat(
      'hello',
      'gpt-4o',
      'role',
      baseURL(),
      '/responses',
      'sk-test',
      '',
      true,
      'Authorization: Bearer'
    )
    assert.equal(res.isStream, true)
    const content = await collectStream(res.sessionId)
    assert.equal(content, 'Hello world')
  })

  it('streams anthropic messages', async () => {
    const res = await AIchat(
      'hello',
      'claude-sonnet-4-5',
      'role',
      baseURL(),
      '/messages',
      'sk-ant',
      '',
      true,
      'x-api-key'
    )
    assert.equal(res.isStream, true)
    const content = await collectStream(res.sessionId)
    assert.equal(content, 'Hello world')
  })
})

describe('error handling', () => {
  it('surfaces a non 2xx anthropic error body', async () => {
    const badServer = http.createServer((req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' }
      }))
    })
    await new Promise(resolve => badServer.listen(0, '127.0.0.1', resolve))
    const badPort = badServer.address().port
    try {
      const res = await AIchatWithTools(
        [{ role: 'user', content: 'hi' }],
        'claude-sonnet-4-5',
        `http://127.0.0.1:${badPort}`,
        '/messages',
        'bad',
        '',
        [],
        'x-api-key'
      )
      assert.match(res.error, /invalid x-api-key/)
    } finally {
      badServer.close()
    }
  })
})

describe('AIlistModels', () => {
  it('normalizes and dedupes the openai style model list', async () => {
    const res = await AIlistModels(baseURL(), 'test-key', 'Authorization: Bearer')
    assert.deepEqual(res, {
      models: ['deepseek-chat', 'deepseek-reasoner']
    })
    const req = lastRequest('/models')
    assert.equal(req.headers.authorization, 'Bearer test-key')
  })

  it('tolerates a trailing slash and the {models:[{name}]} shape', async () => {
    const res = await AIlistModels(`${baseURL()}/alt/`, 'k', 'Authorization: Bearer')
    assert.deepEqual(res, { models: ['model-a', 'model-b'] })
  })

  it('adds the anthropic version header for x-api-key auth', async () => {
    await AIlistModels(baseURL(), 'k', 'x-api-key')
    const req = lastRequest('/models')
    assert.equal(req.headers['anthropic-version'], '2023-06-01')
    assert.equal(req.headers['x-api-key'], 'k')
  })

  it('returns an error when /models is missing', async () => {
    const res = await AIlistModels(`${baseURL()}/nope`, 'k', 'Authorization: Bearer')
    assert.ok(res.error)
  })
})
