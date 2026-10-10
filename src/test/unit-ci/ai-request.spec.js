const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('AI renderer request helper', () => {
  it('appends provider options in the correct positional slot for chat requests', async () => {
    const calls = []
    global.window = { pre: { runGlobalAsync: (...args) => { calls.push(args); return Promise.resolve({}) } } }
    const { runAIchat } = await import('../../client/components/ai/ai-request.js')
    await runAIchat('chatgpt', 'prompt', 'model', 'role', '', '', '', '', false, '')
    assert.equal(calls[0][0], 'AIchat')
    assert.equal(calls[0][10], undefined)
    assert.equal(calls[0][11], undefined)
    assert.deepEqual(calls[0][12], { providerAI: 'chatgpt' })
  })

  it('passes only the selected proxy to subscription model discovery', async () => {
    const calls = []
    global.window = { pre: { runGlobalAsync: (...args) => { calls.push(args); return Promise.resolve({ models: [] }) } } }
    const { runAIlistModels } = await import('../../client/components/ai/ai-request.js')
    await runAIlistModels('supergrok', 'ignored-url', 'ignored-key', 'ignored-header', 'socks5://proxy')
    assert.deepEqual(calls[0], ['AIlistSubscriptionModels', 'supergrok', 'socks5://proxy'])
  })
})
