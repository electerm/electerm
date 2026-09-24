const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

// Client-side (ESM) module: the AI panel builds the outgoing message list and
// the context size indicator from these helpers, so they have to agree with
// each other and with the wire format the main process sends.

let m

before(async () => {
  m = await import('../../../src/client/components/ai/ai-context.js')
})

function entry (over = {}) {
  const prompt = over.prompt === undefined ? 'hello' : over.prompt
  return {
    id: over.id || 'e1',
    chatSessionId: 's1',
    timestamp: 1,
    prompt,
    promptWithAttachments: over.promptWithAttachments === undefined
      ? prompt
      : over.promptWithAttachments,
    response: 'hi',
    ...over
  }
}

describe('estimateTokens', () => {
  it('is 0 for empty input', () => {
    assert.equal(m.estimateTokens(''), 0)
    assert.equal(m.estimateTokens(null), 0)
    assert.equal(m.estimateTokens(undefined), 0)
  })

  it('charges CJK characters more than latin ones', () => {
    const latin = m.estimateTokens('a'.repeat(100))
    const cjk = m.estimateTokens('中'.repeat(100))
    assert.ok(cjk > latin, `${cjk} should exceed ${latin}`)
    // 100 CJK chars ~ 80 tokens, 100 latin chars ~ 29
    assert.equal(cjk, 80)
    assert.equal(latin, 29)
  })

  it('never returns a fraction', () => {
    assert.equal(m.estimateTokens('abc'), Number(m.estimateTokens('abc')))
    assert.ok(Number.isInteger(m.estimateTokens('the quick brown fox')))
  })
})

describe('estimateMessagesTokens', () => {
  it('is 0 for a non array', () => {
    assert.equal(m.estimateMessagesTokens(null), 0)
    assert.equal(m.estimateMessagesTokens(undefined), 0)
  })

  it('adds per message overhead', () => {
    const one = m.estimateMessagesTokens([{ role: 'user', content: '' }])
    const two = m.estimateMessagesTokens([
      { role: 'user', content: '' },
      { role: 'user', content: '' }
    ])
    // 4 tokens of overhead + ceil(4 / 3.5) for the role name
    assert.equal(one, 6)
    assert.equal(two, 12)
  })

  it('counts tool call ids, names and arguments', () => {
    const bare = m.estimateMessagesTokens([
      { role: 'assistant', content: 'ok' }
    ])
    const withCall = m.estimateMessagesTokens([
      {
        role: 'assistant',
        content: 'ok',
        tool_calls: [
          {
            id: 'call_1',
            function: {
              name: 'send_terminal_command',
              arguments: '{"command":"ls -la /tmp","tabId":"1"}'
            }
          }
        ]
      }
    ])
    assert.ok(withCall > bare + 15, `${withCall} vs ${bare}`)
  })

  it('ignores holes in the array', () => {
    assert.equal(
      m.estimateMessagesTokens([null, { role: 'user', content: '' }]),
      m.estimateMessagesTokens([{ role: 'user', content: '' }])
    )
  })
})

describe('estimateToolsTokens', () => {
  it('is 0 without tools', () => {
    assert.equal(m.estimateToolsTokens([]), 0)
    assert.equal(m.estimateToolsTokens(null), 0)
  })

  it('grows with the schema', () => {
    const small = m.estimateToolsTokens([
      { type: 'function', function: { name: 'a' } }
    ])
    const big = m.estimateToolsTokens([
      {
        type: 'function',
        function: {
          name: 'a',
          description: 'x'.repeat(1000),
          parameters: { type: 'object', properties: {} }
        }
      }
    ])
    assert.ok(small > 0)
    assert.ok(big > small + 200)
  })
})

describe('getContextWindow', () => {
  it('prefers the declared value from config', () => {
    assert.deepEqual(
      m.getContextWindow('gpt-4o', 32000),
      { size: 32000, source: 'config' }
    )
    assert.deepEqual(
      m.getContextWindow('gpt-4o', '32000'),
      { size: 32000, source: 'config' }
    )
  })

  it('treats empty and invalid overrides as "detect it"', () => {
    assert.equal(m.getContextWindow('gpt-4o', '').source, 'model')
    assert.equal(m.getContextWindow('gpt-4o', null).source, 'model')
    assert.equal(m.getContextWindow('gpt-4o', 0).source, 'model')
    assert.equal(m.getContextWindow('gpt-4o', 'abc').source, 'model')
  })

  it('knows the current model families', () => {
    assert.equal(m.getContextWindow('deepseek-v4-flash-0731').size, 1000000)
    assert.equal(m.getContextWindow('claude-sonnet-5').size, 1000000)
    assert.equal(m.getContextWindow('claude-3-5-sonnet-20241022').size, 200000)
    assert.equal(m.getContextWindow('gpt-4o-mini').size, 128000)
    assert.equal(m.getContextWindow('gemini-2.0-flash').size, 1048576)
    assert.equal(m.getContextWindow('kimi-k3').size, 1048576)
  })

  it('falls back to the default for unknown models', () => {
    assert.deepEqual(
      m.getContextWindow('some-local-llama-fork'),
      { size: m.DEFAULT_CONTEXT_WINDOW, source: 'default' }
    )
    assert.equal(m.getContextWindow('').source, 'default')
    assert.equal(m.getContextWindow(undefined).source, 'default')
  })
})

describe('buildSessionMessages', () => {
  it('returns null without a session', () => {
    assert.equal(m.buildSessionMessages({ history: [], chatSessionId: '' }), null)
  })

  it('always leads with the system role', () => {
    const messages = m.buildSessionMessages({
      history: [entry()],
      chatSessionId: 's1',
      role: 'ROLE'
    })
    assert.deepEqual(messages[0], { role: 'system', content: 'ROLE' })
  })

  it('only takes this session, in time order', () => {
    const messages = m.buildSessionMessages({
      history: [
        entry({ id: 'b', timestamp: 20, prompt: 'second', response: 'r2' }),
        entry({ id: 'x', timestamp: 5, chatSessionId: 'other', prompt: 'nope' }),
        entry({ id: 'a', timestamp: 10, prompt: 'first', response: 'r1' })
      ],
      chatSessionId: 's1'
    })
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'r1' },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'r2' }
    ])
  })

  it('stops at `upto`', () => {
    const messages = m.buildSessionMessages({
      history: [
        entry({ id: 'a', timestamp: 10, prompt: 'first' }),
        entry({ id: 'b', timestamp: 20, prompt: 'second' })
      ],
      chatSessionId: 's1',
      upto: 10
    })
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'hi' }
    ])
  })

  it('drops the response of `excludeId` (the turn being sent)', () => {
    const messages = m.buildSessionMessages({
      history: [
        entry({ id: 'a', timestamp: 10, prompt: 'first', response: 'r1' }),
        entry({ id: 'b', timestamp: 20, prompt: 'second', response: 'r2' })
      ],
      chatSessionId: 's1',
      excludeId: 'b'
    })
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'r1' },
      { role: 'user', content: 'second' }
    ])
  })

  it('starts from the last compressed entry', () => {
    const messages = m.buildSessionMessages({
      history: [
        entry({ id: 'a', timestamp: 10, prompt: 'old prompt', response: 'old answer' }),
        entry({ id: 'c', timestamp: 20, compressed: true, response: 'SUMMARY' }),
        entry({ id: 'b', timestamp: 30, prompt: 'new prompt', response: 'new answer' })
      ],
      chatSessionId: 's1'
    })
    assert.deepEqual(messages.slice(1), [
      {
        role: 'user',
        content: 'Here is a summary of our previous conversation for context:\n\nSUMMARY'
      },
      { role: 'assistant', content: 'Understood. I will use this context as we continue.' },
      { role: 'user', content: 'new prompt' },
      { role: 'assistant', content: 'new answer' }
    ])
  })

  it('prefers promptWithAttachments over prompt', () => {
    const messages = m.buildSessionMessages({
      history: [
        entry({ prompt: 'short', promptWithAttachments: 'short\n\n<file>body</file>' })
      ],
      chatSessionId: 's1'
    })
    assert.equal(messages[1].content, 'short\n\n<file>body</file>')
  })

  it('skips an empty response', () => {
    const messages = m.buildSessionMessages({
      history: [entry({ response: '' })],
      chatSessionId: 's1'
    })
    assert.equal(messages.length, 2)
  })
})

describe('buildAgentMessages', () => {
  const systemPrompt = 'AGENT'

  it('keeps the session history and swaps the system prompt', () => {
    const messages = m.buildAgentMessages({
      systemPrompt,
      conversationMessages: [
        { role: 'system', content: 'CHAT ROLE' },
        { role: 'user', content: 'do it' }
      ],
      prompt: 'do it'
    })
    assert.deepEqual(messages, [
      { role: 'system', content: 'AGENT' },
      { role: 'user', content: 'do it' }
    ])
  })

  it('falls back to the prompt when there is no history', () => {
    const messages = m.buildAgentMessages({
      systemPrompt,
      conversationMessages: null,
      prompt: 'standalone'
    })
    assert.deepEqual(messages, [
      { role: 'system', content: 'AGENT' },
      { role: 'user', content: 'standalone' }
    ])
  })

  it('treats a system-only history as no history', () => {
    const messages = m.buildAgentMessages({
      systemPrompt,
      conversationMessages: [{ role: 'system', content: 'CHAT ROLE' }],
      prompt: 'standalone'
    })
    assert.deepEqual(messages[1], { role: 'user', content: 'standalone' })
  })
})

describe('summarizeContext', () => {
  it('totals messages plus tools and fills the window', () => {
    const messages = [
      { role: 'system', content: 'x'.repeat(350) },
      { role: 'user', content: 'y'.repeat(350) }
    ]
    const info = m.summarizeContext(messages, {
      model: 'gpt-4o',
      tools: [{ type: 'function', function: { name: 'z'.repeat(350) } }]
    })
    assert.equal(info.messagesTokens, 212)
    assert.ok(info.toolsTokens > 100)
    assert.equal(info.tokens, info.messagesTokens + info.toolsTokens)
    assert.equal(info.windowSize, 128000)
    assert.equal(info.windowSource, 'model')
    assert.equal(info.measuredTokens, null)
    assert.ok(Math.abs(info.percent - (info.tokens / 128000) * 100) < 1e-9)
  })

  it('uses the declared window', () => {
    const info = m.summarizeContext([{ role: 'user', content: 'hi' }], {
      model: 'gpt-4o',
      contextLength: 1000
    })
    assert.equal(info.windowSize, 1000)
    assert.equal(info.windowSource, 'config')
    assert.ok(info.percent > 0)
  })
})

describe('formatting', () => {
  it('formats token counts', () => {
    assert.equal(m.formatTokens(0), '0')
    assert.equal(m.formatTokens(999), '999')
    assert.equal(m.formatTokens(4200), '4.2k')
    assert.equal(m.formatTokens(42000), '42k')
    assert.equal(m.formatTokens(128000), '128k')
    assert.equal(m.formatTokens(1048576), '1.0M')
  })

  it('formats percentages', () => {
    assert.equal(m.formatPercent(33.4), '33%')
    assert.equal(m.formatPercent(0.4), '0.4%')
    assert.equal(m.formatPercent(null), '')
  })

  it('grades the usage', () => {
    assert.equal(m.getUsageLevel(0), 'ok')
    assert.equal(m.getUsageLevel(69.9), 'ok')
    assert.equal(m.getUsageLevel(70), 'warn')
    assert.equal(m.getUsageLevel(90), 'danger')
    assert.equal(m.getUsageLevel(140), 'danger')
    assert.equal(m.getUsageLevel(null), 'unknown')
  })
})
