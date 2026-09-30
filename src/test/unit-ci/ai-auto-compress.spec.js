const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

// Auto compression for agent mode: the loop decides whether to compact itself
// from the context figure and rewrites the live message array in place, so the
// decision and the rewrite are pinned here.

let m

before(async () => {
  m = await import('../../../src/client/components/ai/ai-auto-compress.js')
})

describe('shouldAutoCompress', () => {
  it('is false without a context figure', () => {
    assert.equal(m.shouldAutoCompress(null), false)
    assert.equal(m.shouldAutoCompress(undefined), false)
  })

  it('is false when the window size is unknown (percent null)', () => {
    assert.equal(m.shouldAutoCompress({ percent: null }), false)
    assert.equal(m.shouldAutoCompress({ percent: undefined }), false)
    assert.equal(m.shouldAutoCompress({ percent: NaN }), false)
  })

  it('waits for the danger threshold', () => {
    assert.equal(m.shouldAutoCompress({ percent: 50 }), false)
    assert.equal(m.shouldAutoCompress({ percent: 89.9 }), false)
    assert.equal(m.shouldAutoCompress({ percent: 90 }), true)
    assert.equal(m.shouldAutoCompress({ percent: 120 }), true)
  })

  it('accepts an explicit threshold', () => {
    assert.equal(m.shouldAutoCompress({ percent: 71 }, 70), true)
    assert.equal(m.shouldAutoCompress({ percent: 69 }, 70), false)
  })
})

describe('canCompact', () => {
  it('is false for a fresh turn with nothing but the prompt', () => {
    assert.equal(m.canCompact(null), false)
    assert.equal(m.canCompact([{ role: 'system', content: 's' }]), false)
    assert.equal(m.canCompact([
      { role: 'system', content: 's' },
      { role: 'user', content: 'u' }
    ]), false)
  })

  it('is true once there is a reply or a tool result to fold in', () => {
    assert.equal(m.canCompact([
      { role: 'system', content: 's' },
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
      { role: 'user', content: 'u2' }
    ]), true)
  })
})

describe('splitPendingTurn', () => {
  it('lifts the prompt being answered out of the history', () => {
    const system = { role: 'system', content: 's' }
    const pending = { role: 'user', content: 'the live question' }
    const { context, pending: p } = m.splitPendingTurn([
      system,
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: 'answer' },
      pending
    ])
    assert.deepEqual(context, [
      system,
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: 'answer' }
    ])
    assert.equal(p, pending)
  })

  it('handles a list without a trailing user turn and a non-list', () => {
    const messages = [
      { role: 'system', content: 's' },
      { role: 'assistant', content: 'a' }
    ]
    assert.deepEqual(m.splitPendingTurn(messages), {
      context: messages,
      pending: null
    })
    assert.deepEqual(m.splitPendingTurn(null), { context: [], pending: null })
  })
})

describe('compactAskMessages', () => {
  it('is system + summary + the untouched live prompt', () => {
    const pending = { role: 'user', content: 'the live question' }
    const messages = [
      { role: 'system', content: 's' },
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: 'answer' },
      pending
    ]
    const next = m.compactAskMessages(messages, 'SUMMARY')
    assert.deepEqual(next, [
      { role: 'system', content: 's' },
      {
        role: 'user',
        content: 'Here is a summary of our previous conversation for context:\n\nSUMMARY'
      },
      { role: 'assistant', content: 'Understood. I will use this context as we continue.' },
      pending
    ])
    // the memoized list the turn was built from is left alone
    assert.equal(messages.length, 4)
  })

  it('leaves a summary-free list alone', () => {
    const messages = [{ role: 'system', content: 's' }]
    assert.equal(m.compactAskMessages(messages, ''), messages)
  })
})

describe('applySummary', () => {
  it('keeps the system prompt and replaces everything else', () => {
    const messages = [
      { role: 'system', content: 'agent instructions' },
      { role: 'user', content: 'list files' },
      { role: 'assistant', content: 'ok', tool_calls: [{ id: 't1' }] },
      { role: 'tool', tool_call_id: 't1', content: 'a\nb' }
    ]
    m.applySummary(messages, 'SUMMARY')
    assert.deepEqual(messages, [
      { role: 'system', content: 'agent instructions' },
      {
        role: 'user',
        content: 'Here is a summary of our previous conversation for context:\n\nSUMMARY'
      },
      { role: 'assistant', content: 'Understood. I will use this context as we continue.' }
    ])
  })

  it('mutates the array the caller holds, so the loop keeps compacting', () => {
    const messages = [
      { role: 'system', content: 's' },
      { role: 'user', content: 'u' }
    ]
    const returned = m.applySummary(messages, 'SUMMARY')
    assert.equal(returned, messages)
    assert.equal(messages.length, 3)
  })

  it('works without a system prompt and leaves a summary-free list alone', () => {
    const messages = [{ role: 'user', content: 'u' }]
    m.applySummary(messages, 'SUMMARY')
    assert.deepEqual(messages[0], {
      role: 'user',
      content: 'Here is a summary of our previous conversation for context:\n\nSUMMARY'
    })

    const untouched = [{ role: 'system', content: 's' }]
    assert.equal(m.applySummary(untouched, ''), untouched)
    assert.equal(untouched.length, 1)
  })
})
