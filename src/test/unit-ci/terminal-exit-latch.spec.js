const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

// term-suggestions.js pulls in the component ref holder, which touches
// `window` at module load. Nothing here needs a real DOM.
globalThis.window = globalThis.window || { store: {} }

const loadMixin = () => import('../../client/components/terminal/mixins/term-suggestions.js')

/**
 * The exit latch only reads `this`, `Date.now()` and the current input line,
 * so a bare object standing in for the terminal component is enough.
 */
async function fakeTerm (line = '') {
  const { suggestionsMixin } = await loadMixin()
  const ctx = Object.assign({}, suggestionsMixin, {
    line,
    getCurrentInput () {
      return this.line
    },
    shouldUseManualHistory: () => false,
    closeSuggestions: () => {}
  })
  ctx.setUserTypeExit(false)
  return ctx
}

async function withClock (fn) {
  const real = Date.now
  let now = 1_000_000
  Date.now = () => now
  try {
    return await fn({ advance: ms => { now += ms } })
  } finally {
    Date.now = real
  }
}

describe('terminal exit latch', () => {
  test('a submitted exit explains a close right after it, not later', async () => {
    const { exitCloseWindow } = await loadMixin()
    const term = await fakeTerm('exit')
    await withClock(async ({ advance }) => {
      assert.equal(term.isUserTypeExit(), false, 'not armed before typing')

      term.handleInputEvent('\r')
      assert.equal(term.isUserTypeExit(), true, 'exit arms the latch')

      // A close that arrives within the window is the user ending the session.
      advance(exitCloseWindow)
      assert.equal(term.isUserTypeExit(), true, 'still inside the window')

      // Same latch, minutes later: that close is a plain disconnect and the
      // tab has to stay alive (#4629).
      advance(1)
      assert.equal(term.isUserTypeExit(), false, 'expired latch')
    })
  })

  test('a fresh prompt disarms the latch, so nested exit cannot close the tab', async () => {
    const term = await fakeTerm('exit')
    await withClock(async ({ advance }) => {
      term.handleInputEvent('\r')
      assert.equal(term.isUserTypeExit(), true)

      // `su`, `tmux`, a second ssh: the exit left the nested shell and the
      // outer shell drew a prompt again.
      term.clearUserTypeExit()
      assert.equal(term.isUserTypeExit(), false, 'prompt disarms it')

      // Even a disconnect inside the window must not close the tab now.
      advance(100)
      assert.equal(term.isUserTypeExit(), false)
    })
  })

  test('the next submitted line re-decides the latch', async () => {
    const term = await fakeTerm('exit')
    term.handleInputEvent('\r')
    assert.equal(term.userTypeExit, true)

    term.line = 'echo exit'
    term.handleInputEvent('\r')
    assert.equal(term.userTypeExit, false, 'a line mentioning exit is not exit')
  })

  test('only exit/logout as the command counts', async () => {
    const cases = [
      ['exit', true],
      ['exit 3', true],
      ['logout', true],
      ['  exit  ', true],
      ['sudo -i', false],
      ['exitcode', false],
      ['exit()', false],
      ['', false]
    ]
    for (const [line, armed] of cases) {
      const term = await fakeTerm(line)
      term.handleInputEvent('\r')
      assert.equal(term.userTypeExit, armed, `line: ${JSON.stringify(line)}`)
    }
  })

  test('Ctrl+D arms the latch only on an empty line', async () => {
    const empty = await fakeTerm('')
    empty.handleInputEvent('\x04')
    assert.equal(empty.userTypeExit, true)

    const typed = await fakeTerm('rm -rf /tmp/x')
    typed.handleInputEvent('\x04')
    assert.equal(typed.userTypeExit, false, 'Ctrl+D is delete-char here')
  })
})
