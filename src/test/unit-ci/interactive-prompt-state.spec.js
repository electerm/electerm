/**
 * The auto-reconnect gate for tabs whose last attempt ended on an unanswered
 * interactive prompt (MFA code, password, host key trust).
 *
 * Retrying such a tab asks the same question again, and no retry can answer it
 * on its own: the dialog just stacks up behind a modal mask until the window is
 * dead (#4634). The state lives in a module-level set because the dialog is a
 * single global component with no per-tab lifecycle.
 */

const { describe, test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/interactive-prompt-state.js')

describe('interactive prompt state', () => {
  let mark
  let clear
  let needs

  beforeEach(async () => {
    const mod = await load()
    mark = mod.markNeedsInteractiveInput
    clear = mod.clearNeedsInteractiveInput
    needs = mod.needsInteractiveInput
  })

  test('a tab starts out reconnectable', () => {
    assert.equal(needs('fresh-tab'), false)
  })

  test('a cancelled or timed-out prompt blocks auto reconnect for that tab', () => {
    mark('prompt-tab')
    assert.equal(needs('prompt-tab'), true)
  })

  test('the block is per tab', () => {
    mark('blocked-tab')
    assert.equal(needs('other-tab'), false,
      'another tab still waiting on its own prompt is unaffected')
  })

  test('answering the prompt makes the tab reconnectable again', () => {
    mark('answered-tab')
    clear('answered-tab')
    assert.equal(needs('answered-tab'), false)
  })

  test('reloadTab mints a new id, so a fresh attempt starts clean', () => {
    mark('reloaded-tab')
    // the new attempt does not have to clear anything itself: it is a new key
    assert.equal(needs('reloaded-tab-2'), false)
  })

  test('a prompt with no tab id is ignored instead of leaking a key', () => {
    mark(undefined)
    mark(null)
    mark('')
    assert.equal(needs(undefined), false)
    assert.equal(needs(null), false)
    assert.equal(needs(''), false)
    // clearing an unmarked or unknown tab must not throw
    clear('never-marked')
  })

  test('the last answer wins: marking after a clear blocks again', () => {
    mark('reask-tab')
    clear('reask-tab')
    mark('reask-tab')
    assert.equal(needs('reask-tab'), true,
      'a second unanswered prompt on the same tab blocks it again')
  })
})
