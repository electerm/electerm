const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  detectFormat,
  headersForFormat,
  buildRequest,
  parseResponse,
  createStreamParser,
  streamResultToMessage,
  FORMAT_OPENAI_CHAT,
  FORMAT_OPENAI_RESPONSES,
  FORMAT_ANTHROPIC
} = require('../../../src/app/lib/ai-format')

// helper: run a list of raw chunks through a parser, returns the parser
function runStream (format, chunks) {
  const parser = createStreamParser(format)
  for (const c of chunks) {
    parser.feed(c)
  }
  parser.flush()
  return parser
}

describe('detectFormat', () => {
  it('detects openai chat completions', () => {
    assert.equal(detectFormat('/chat/completions'), FORMAT_OPENAI_CHAT)
    assert.equal(detectFormat('/v1/chat/completions'), FORMAT_OPENAI_CHAT)
    assert.equal(detectFormat('/api/ai/chat/completions'), FORMAT_OPENAI_CHAT)
  })

  it('detects openai responses', () => {
    assert.equal(detectFormat('/responses'), FORMAT_OPENAI_RESPONSES)
    assert.equal(detectFormat('/v1/responses'), FORMAT_OPENAI_RESPONSES)
  })

  it('detects anthropic messages', () => {
    assert.equal(detectFormat('/messages'), FORMAT_ANTHROPIC)
    assert.equal(detectFormat('/v1/messages'), FORMAT_ANTHROPIC)
  })

  it('falls back to openai chat for unknown paths', () => {
    assert.equal(detectFormat(''), FORMAT_OPENAI_CHAT)
    assert.equal(detectFormat(undefined), FORMAT_OPENAI_CHAT)
    assert.equal(detectFormat('/some/proxy'), FORMAT_OPENAI_CHAT)
  })

  it('lets an explicit format override the path', () => {
    assert.equal(detectFormat('/chat/completions', FORMAT_ANTHROPIC), FORMAT_ANTHROPIC)
    assert.equal(detectFormat('/messages', FORMAT_OPENAI_RESPONSES), FORMAT_OPENAI_RESPONSES)
    // invalid explicit value is ignored
    assert.equal(detectFormat('/responses', 'nope'), FORMAT_OPENAI_RESPONSES)
  })

  it('is case insensitive', () => {
    assert.equal(detectFormat('/V1/Responses'), FORMAT_OPENAI_RESPONSES)
    assert.equal(detectFormat('/V1/Messages'), FORMAT_ANTHROPIC)
  })
})

describe('headersForFormat', () => {
  it('adds anthropic-version only for anthropic', () => {
    assert.deepEqual(headersForFormat(FORMAT_ANTHROPIC), {
      'anthropic-version': '2023-06-01'
    })
    assert.deepEqual(headersForFormat(FORMAT_OPENAI_CHAT), {})
    assert.deepEqual(headersForFormat(FORMAT_OPENAI_RESPONSES), {})
  })
})

describe('buildRequest - openai chat', () => {
  it('passes messages straight through', () => {
    const body = buildRequest(FORMAT_OPENAI_CHAT, {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' }
      ],
      stream: true
    })
    assert.deepEqual(body, {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' }
      ],
      stream: true
    })
  })

  it('includes tools when provided and omits when empty', () => {
    const tools = [{ type: 'function', function: { name: 'run' } }]
    const withTools = buildRequest(FORMAT_OPENAI_CHAT, {
      model: 'm',
      messages: [],
      tools
    })
    assert.deepEqual(withTools.tools, tools)
    const withoutTools = buildRequest(FORMAT_OPENAI_CHAT, {
      model: 'm',
      messages: [],
      tools: []
    })
    assert.equal('tools' in withoutTools, false)
  })
})

describe('buildRequest - openai responses', () => {
  it('moves system prompt to instructions and keeps input', () => {
    const body = buildRequest(FORMAT_OPENAI_RESPONSES, {
      model: 'gpt-5',
      messages: [
        { role: 'system', content: 'you are helpful' },
        { role: 'user', content: 'hi' }
      ],
      stream: false
    })
    assert.equal(body.model, 'gpt-5')
    assert.equal(body.instructions, 'you are helpful')
    assert.deepEqual(body.input, [{ role: 'user', content: 'hi' }])
    assert.equal(body.stream, false)
    assert.equal('messages' in body, false)
  })

  it('joins multiple system/developer messages into instructions', () => {
    const body = buildRequest(FORMAT_OPENAI_RESPONSES, {
      model: 'm',
      messages: [
        { role: 'system', content: 'a' },
        { role: 'developer', content: 'b' }
      ]
    })
    assert.equal(body.instructions, 'a\n\nb')
    assert.deepEqual(body.input, [])
  })

  it('flattens tools into the responses shape', () => {
    const body = buildRequest(FORMAT_OPENAI_RESPONSES, {
      model: 'm',
      messages: [],
      tools: [
        {
          type: 'function',
          function: {
            name: 'run_command',
            description: 'run it',
            parameters: { type: 'object', properties: {} }
          }
        }
      ]
    })
    assert.deepEqual(body.tools, [
      {
        type: 'function',
        name: 'run_command',
        description: 'run it',
        parameters: { type: 'object', properties: {} }
      }
    ])
  })

  it('converts assistant tool calls and tool results to items', () => {
    const body = buildRequest(FORMAT_OPENAI_RESPONSES, {
      model: 'm',
      messages: [
        { role: 'user', content: 'do it' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'run_command', arguments: '{"cmd":"ls"}' }
            }
          ]
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'file1' }
      ]
    })
    assert.deepEqual(body.input, [
      { role: 'user', content: 'do it' },
      {
        type: 'function_call',
        call_id: 'call_1',
        name: 'run_command',
        arguments: '{"cmd":"ls"}'
      },
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: 'file1'
      }
    ])
  })

  it('keeps assistant text alongside tool calls', () => {
    const body = buildRequest(FORMAT_OPENAI_RESPONSES, {
      model: 'm',
      messages: [
        {
          role: 'assistant',
          content: 'thinking...',
          tool_calls: [{ id: 'c', function: { name: 'f', arguments: '{}' } }]
        }
      ]
    })
    assert.deepEqual(body.input[0], { role: 'assistant', content: 'thinking...' })
    assert.equal(body.input[1].type, 'function_call')
  })
})

describe('buildRequest - anthropic', () => {
  it('extracts system and sets a default max_tokens', () => {
    const body = buildRequest(FORMAT_ANTHROPIC, {
      model: 'claude-sonnet-4',
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'hi' }
      ],
      stream: true
    })
    assert.equal(body.system, 'be brief')
    assert.equal(body.max_tokens, 4096)
    assert.equal(body.stream, true)
    assert.deepEqual(body.messages, [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] }
    ])
  })

  it('honors custom maxTokens', () => {
    const body = buildRequest(FORMAT_ANTHROPIC, {
      model: 'm',
      messages: [],
      maxTokens: 1234
    })
    assert.equal(body.max_tokens, 1234)
  })

  it('converts tools to input_schema', () => {
    const body = buildRequest(FORMAT_ANTHROPIC, {
      model: 'm',
      messages: [],
      tools: [
        {
          type: 'function',
          function: {
            name: 'run_command',
            description: 'run',
            parameters: { type: 'object', properties: { cmd: { type: 'string' } } }
          }
        }
      ]
    })
    assert.deepEqual(body.tools, [
      {
        name: 'run_command',
        description: 'run',
        input_schema: {
          type: 'object',
          properties: { cmd: { type: 'string' } }
        }
      }
    ])
  })

  it('maps assistant tool_calls to tool_use and tool results to tool_result', () => {
    const body = buildRequest(FORMAT_ANTHROPIC, {
      model: 'm',
      messages: [
        { role: 'user', content: 'do it' },
        {
          role: 'assistant',
          content: 'ok',
          tool_calls: [
            {
              id: 'toolu_1',
              type: 'function',
              function: { name: 'run_command', arguments: '{"cmd":"ls"}' }
            }
          ]
        },
        { role: 'tool', tool_call_id: 'toolu_1', content: 'file1' }
      ]
    })
    assert.deepEqual(body.messages, [
      { role: 'user', content: [{ type: 'text', text: 'do it' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'ok' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'run_command',
            input: { cmd: 'ls' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'file1' }
        ]
      }
    ])
  })

  it('merges consecutive tool results into one user message', () => {
    const body = buildRequest(FORMAT_ANTHROPIC, {
      model: 'm',
      messages: [
        { role: 'tool', tool_call_id: 'a', content: 'A' },
        { role: 'tool', tool_call_id: 'b', content: 'B' }
      ]
    })
    assert.equal(body.messages.length, 1)
    assert.deepEqual(body.messages[0], {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'a', content: 'A' },
        { type: 'tool_result', tool_use_id: 'b', content: 'B' }
      ]
    })
  })

  it('tolerates malformed tool arguments', () => {
    const body = buildRequest(FORMAT_ANTHROPIC, {
      model: 'm',
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 't', function: { name: 'f', arguments: 'not-json' } }
          ]
        }
      ]
    })
    assert.deepEqual(body.messages[0].content[0].input, {})
  })
})

describe('parseResponse - openai chat', () => {
  it('returns the assistant message', () => {
    const res = parseResponse(FORMAT_OPENAI_CHAT, {
      choices: [{ message: { role: 'assistant', content: 'hello' } }]
    })
    assert.deepEqual(res.message, { role: 'assistant', content: 'hello' })
  })

  it('surfaces error bodies', () => {
    const res = parseResponse(FORMAT_OPENAI_CHAT, {
      error: { message: 'bad key' }
    })
    assert.equal(res.error, 'bad key')
  })

  it('parses an sse body from a server ignoring stream:false', () => {
    const body = 'data: {"choices":[{"delta":{"content":"he"}}]}\n\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n'
    const res = parseResponse(FORMAT_OPENAI_CHAT, body)
    assert.equal(res.message.content, 'hello')
  })
})

describe('parseResponse - openai responses', () => {
  it('collects output_text from message items', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, {
      id: 'resp_1',
      object: 'response',
      status: 'completed',
      output: [
        {
          type: 'reasoning',
          summary: []
        },
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'he' },
            { type: 'output_text', text: 'llo' }
          ]
        }
      ]
    })
    assert.deepEqual(res.message, { role: 'assistant', content: 'hello' })
  })

  it('maps function_call items to openai style tool_calls', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, {
      status: 'completed',
      output: [
        {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'run_command',
          arguments: '{"cmd":"ls"}'
        }
      ]
    })
    assert.equal(res.message.content, null)
    assert.deepEqual(res.message.tool_calls, [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'run_command', arguments: '{"cmd":"ls"}' }
      }
    ])
  })

  it('supports text plus tool calls together', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'let me check' }]
        },
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'run',
          arguments: '{}'
        }
      ]
    })
    assert.equal(res.message.content, 'let me check')
    assert.equal(res.message.tool_calls[0].id, 'call_1')
  })

  it('falls back to the output_text convenience field', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, {
      output_text: 'shortcut'
    })
    assert.equal(res.message.content, 'shortcut')
  })

  it('reports error bodies', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, {
      error: { message: 'unsupported model', type: 'invalid_request_error' }
    })
    assert.equal(res.error, 'unsupported model')
  })

  it('reports incomplete responses', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: []
    })
    assert.match(res.error, /incomplete: max_output_tokens/)
  })

  it('errors on empty output', () => {
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, { output: [] })
    assert.match(res.error, /^Unexpected AI response\(no message\)/)
  })
})

describe('parseResponse - anthropic', () => {
  it('joins text blocks', () => {
    const res = parseResponse(FORMAT_ANTHROPIC, {
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'he' },
        { type: 'text', text: 'llo' }
      ],
      stop_reason: 'end_turn'
    })
    assert.deepEqual(res.message, { role: 'assistant', content: 'hello' })
  })

  it('maps tool_use blocks to openai style tool_calls', () => {
    const res = parseResponse(FORMAT_ANTHROPIC, {
      type: 'message',
      content: [
        { type: 'text', text: 'checking' },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'run_command',
          input: { cmd: 'ls' }
        }
      ]
    })
    assert.equal(res.message.content, 'checking')
    assert.deepEqual(res.message.tool_calls, [
      {
        id: 'toolu_1',
        type: 'function',
        function: { name: 'run_command', arguments: '{"cmd":"ls"}' }
      }
    ])
  })

  it('reports anthropic error bodies', () => {
    const res = parseResponse(FORMAT_ANTHROPIC, {
      type: 'error',
      error: { type: 'authentication_error', message: 'invalid x-api-key' }
    })
    assert.equal(res.error, 'invalid x-api-key')
  })

  it('errors on empty content', () => {
    const res = parseResponse(FORMAT_ANTHROPIC, { content: [] })
    assert.match(res.error, /^Unexpected AI response\(no message\)/)
  })
})

describe('createStreamParser - openai chat', () => {
  it('accumulates content across chunk boundaries', () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"He"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n'
    ]
    const parser = runStream(FORMAT_OPENAI_CHAT, chunks)
    assert.equal(parser.content, 'Hello')
    assert.equal(parser.completed, true)
    assert.equal(parser.error, null)
  })

  it('accumulates fragmented tool calls by index', () => {
    const chunks = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"run_command","arguments":""}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"cmd\\":"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"ls\\"}"}}]}}]}\n\n',
      'data: [DONE]\n'
    ]
    const parser = runStream(FORMAT_OPENAI_CHAT, chunks)
    assert.equal(parser.toolCalls.length, 1)
    assert.equal(parser.toolCalls[0].id, 'call_1')
    assert.equal(parser.toolCalls[0].function.name, 'run_command')
    assert.equal(parser.toolCalls[0].function.arguments, '{"cmd":"ls"}')
  })

  it('completes on finish_reason without [DONE]', () => {
    const parser = runStream(FORMAT_OPENAI_CHAT, [
      'data: {"choices":[{"delta":{"content":"x"},"finish_reason":"stop"}]}\n'
    ])
    assert.equal(parser.completed, true)
    assert.equal(parser.content, 'x')
  })

  it('ignores malformed lines and unknown keepalives', () => {
    const parser = runStream(FORMAT_OPENAI_CHAT, [
      ': ping\n',
      'data: not-json\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
      'data: [DONE]\n'
    ])
    assert.equal(parser.content, 'ok')
  })

  it('captures error payloads', () => {
    const parser = runStream(FORMAT_OPENAI_CHAT, [
      'data: {"error":{"message":"rate limited"}}\n'
    ])
    assert.equal(parser.error, 'rate limited')
    assert.equal(parser.completed, true)
  })

  it('accepts raw json lines without the data prefix', () => {
    const parser = runStream(FORMAT_OPENAI_CHAT, [
      '{"choices":[{"delta":{"content":"raw"}}]}\n'
    ])
    assert.equal(parser.content, 'raw')
  })
})

describe('createStreamParser - openai responses', () => {
  it('accumulates text deltas', () => {
    const chunks = [
      'event: response.created\ndata: {"type":"response.created"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"lo"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n'
    ]
    const parser = runStream(FORMAT_OPENAI_RESPONSES, chunks)
    assert.equal(parser.content, 'Hello')
    assert.equal(parser.completed, true)
  })

  it('accumulates function call arguments', () => {
    const chunks = [
      'event: response.output_item.added\ndata: {"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"run_command","arguments":""}}\n\n',
      'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"{\\"cmd\\":"}\n\n',
      'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"\\"ls\\"}"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n'
    ]
    const parser = runStream(FORMAT_OPENAI_RESPONSES, chunks)
    assert.equal(parser.toolCalls.length, 1)
    assert.equal(parser.toolCalls[0].id, 'call_1')
    assert.equal(parser.toolCalls[0].function.name, 'run_command')
    assert.equal(parser.toolCalls[0].function.arguments, '{"cmd":"ls"}')
    assert.equal(parser.completed, true)
  })

  it('reports failed events', () => {
    const parser = runStream(FORMAT_OPENAI_RESPONSES, [
      'event: response.failed\ndata: {"type":"response.failed","response":{"error":{"message":"boom"}}}\n\n'
    ])
    assert.equal(parser.error, 'boom')
    assert.equal(parser.completed, true)
  })
})

describe('createStreamParser - anthropic', () => {
  it('accumulates text deltas', () => {
    const chunks = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]
    const parser = runStream(FORMAT_ANTHROPIC, chunks)
    assert.equal(parser.content, 'Hello')
    assert.equal(parser.completed, true)
  })

  it('accumulates tool_use input via input_json_delta', () => {
    const chunks = [
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"run_command","input":{}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"cmd\\":"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"ls\\"}"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]
    const parser = runStream(FORMAT_ANTHROPIC, chunks)
    assert.equal(parser.toolCalls.length, 1)
    assert.equal(parser.toolCalls[0].id, 'toolu_1')
    assert.equal(parser.toolCalls[0].function.name, 'run_command')
    assert.equal(parser.toolCalls[0].function.arguments, '{"cmd":"ls"}')
  })

  it('handles a non empty starting input', () => {
    const parser = runStream(FORMAT_ANTHROPIC, [
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t","name":"f","input":{"a":1}}}\n\n'
    ])
    assert.equal(parser.toolCalls[0].function.arguments, '{"a":1}')
  })

  it('reports error events', () => {
    const parser = runStream(FORMAT_ANTHROPIC, [
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"overloaded"}}\n\n'
    ])
    assert.equal(parser.error, 'overloaded')
    assert.equal(parser.completed, true)
  })
})

describe('streamResultToMessage', () => {
  it('builds an openai style message', () => {
    const parser = runStream(FORMAT_ANTHROPIC, [
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}\n\n'
    ])
    assert.deepEqual(streamResultToMessage(parser), {
      role: 'assistant',
      content: 'hi'
    })
  })

  it('returns null content when only tool calls are present', () => {
    const parser = runStream(FORMAT_ANTHROPIC, [
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t","name":"f","input":{}}}\n\n'
    ])
    const msg = streamResultToMessage(parser)
    assert.equal(msg.content, null)
    assert.equal(msg.tool_calls[0].function.name, 'f')
  })
})

describe('parseResponse - sse text body fallback for new formats', () => {
  it('parses anthropic sse text', () => {
    const body = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"he"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"llo"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      ''
    ].join('\n')
    const res = parseResponse(FORMAT_ANTHROPIC, body)
    assert.equal(res.message.content, 'hello')
  })

  it('parses responses sse text', () => {
    const body = [
      'data: {"type":"response.output_text.delta","delta":"ok"}',
      '',
      'data: {"type":"response.completed"}',
      ''
    ].join('\n')
    const res = parseResponse(FORMAT_OPENAI_RESPONSES, body)
    assert.equal(res.message.content, 'ok')
  })

  it('errors on a non sse plain text body', () => {
    const res = parseResponse(FORMAT_ANTHROPIC, '<html>502</html>')
    assert.match(res.error, /502/)
  })
})

describe('cross format round trip (agent loop contract)', () => {
  // The agent loop only ever sees { content, tool_calls:[{id,function:{name,arguments}}] }
  // so every protocol must normalize to that shape.

  it('openai chat: request -> response -> tool result request', () => {
    const fmt = detectFormat('/chat/completions')
    const firstBody = buildRequest(fmt, {
      model: 'm',
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'list files' }
      ],
      tools: [{ type: 'function', function: { name: 'run_command' } }]
    })
    assert.equal(firstBody.messages.length, 2)

    const parsed = parseResponse(fmt, {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'run_command', arguments: '{"cmd":"ls"}' }
            }
          ]
        }
      }]
    })
    const assistantMessage = parsed.message
    const toolCall = assistantMessage.tool_calls[0]
    const nextBody = buildRequest(fmt, {
      model: 'm',
      messages: [
        ...firstBody.messages,
        assistantMessage,
        { role: 'tool', tool_call_id: toolCall.id, content: 'a.txt' }
      ]
    })
    assert.equal(nextBody.messages[2].tool_calls[0].id, 'call_1')
    assert.equal(nextBody.messages[3].role, 'tool')
  })

  it('openai responses: assistant output stays compatible on the next turn', () => {
    const fmt = detectFormat('/responses')
    const parsed = parseResponse(fmt, {
      output: [
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'run_command',
          arguments: '{"cmd":"ls"}'
        }
      ]
    })
    const nextBody = buildRequest(fmt, {
      model: 'm',
      messages: [
        { role: 'user', content: 'go' },
        parsed.message,
        { role: 'tool', tool_call_id: parsed.message.tool_calls[0].id, content: 'a.txt' }
      ]
    })
    assert.deepEqual(nextBody.input[1], {
      type: 'function_call',
      call_id: 'call_1',
      name: 'run_command',
      arguments: '{"cmd":"ls"}'
    })
    assert.deepEqual(nextBody.input[2], {
      type: 'function_call_output',
      call_id: 'call_1',
      output: 'a.txt'
    })
  })

  it('anthropic: assistant output stays compatible on the next turn', () => {
    const fmt = detectFormat('/v1/messages')
    const parsed = parseResponse(fmt, {
      content: [
        { type: 'text', text: 'running' },
        { type: 'tool_use', id: 'toolu_1', name: 'run_command', input: { cmd: 'ls' } }
      ]
    })
    const nextBody = buildRequest(fmt, {
      model: 'm',
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'go' },
        parsed.message,
        { role: 'tool', tool_call_id: parsed.message.tool_calls[0].id, content: 'a.txt' }
      ],
      tools: [{ function: { name: 'run_command' } }]
    })
    assert.equal(nextBody.system, 's')
    assert.deepEqual(nextBody.messages[1].content[1], {
      type: 'tool_use',
      id: 'toolu_1',
      name: 'run_command',
      input: { cmd: 'ls' }
    })
    assert.deepEqual(nextBody.messages[2].content[0], {
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      content: 'a.txt'
    })
    assert.deepEqual(nextBody.tools[0].input_schema, {
      type: 'object',
      properties: {}
    })
  })
})
