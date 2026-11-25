const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

// term-suggestions.js pulls in the component ref holder, which touches
// `window` at module load. Nothing here needs a real DOM.
globalThis.window = globalThis.window || { store: {} }

const loadMixin = () => import('../../client/components/terminal/mixins/term-suggestions.js')

const type = (term, text) => {
  for (const ch of text) {
    term.handleInputEvent(ch)
  }
}

/**
 * The exit latch only reads `this`, `Date.now()` and the line rebuilt from
 * the input stream, so a bare object standing in for the terminal component
 * is enough.
 */
async function fakeTerm (typed = '') {
  const { suggestionsMixin } = await loadMixin()
  const ctx = Object.assign({}, suggestionsMixin, {
    getCurrentInput: () => '',
    shouldUseManualHistory: () => false,
    closeSuggestions: () => {}
  })
  ctx.resetTypedLine()
  ctx.setUserTypeExit(false)
  type(ctx, typed)
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
      assert.equal(term.isUserTypeExit(), false, 'not armed before submitting')

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

    type(term, 'echo exit')
    term.handleInputEvent('\r')
    assert.equal(term.userTypeExit, false, 'a line mentioning exit is not exit')
  })

  test('only a session-ending command counts', async () => {
    const cases = [
      ['exit', true],
      ['exit 3', true],
      ['logout', true],
      ['quit', true],
      // what a Comware / IOS prompt renders: `<NMYC-WH-FH-MSR3600>exit`.
      // The prompt is drawn output, not input, so it never reaches the latch.
      ['exit', true],
      ['  exit  ', true],
      ['sudo -i', false],
      ['exitcode', false],
      ['exit()', false],
      ['quitter', false],
      ['', false]
    ]
    for (const [line, armed] of cases) {
      const term = await fakeTerm(line)
      term.handleInputEvent('\r')
      assert.equal(term.userTypeExit, armed, `line: ${JSON.stringify(line)}`)
    }
  })

  test('backspace edits the composed line', async () => {
    const term = await fakeTerm('exiX')
    term.handleInputEvent('\x7f')
    type(term, 't')
    term.handleInputEvent('\r')
    assert.equal(term.userTypeExit, true)

    // Ctrl+U wipes the line, so the next Enter submits nothing
    const cleared = await fakeTerm('exit')
    cleared.handleInputEvent('\x15')
    cleared.handleInputEvent('\r')
    assert.equal(cleared.userTypeExit, false)
  })

  test('text that did not come from the keyboard proves nothing', async () => {
    // Up-arrow recalls `exit` from history: the line is right, the evidence
    // is not, and holding the tab is the safe direction.
    const term = await fakeTerm('')
    term.handleInputEvent('\x1b[A')
    type(term, 'exit')
    term.handleInputEvent('\r')
    assert.equal(term.userTypeExit, false, 'escape sequence makes the line unusable')

    // an IME commit is a multi-byte chunk, not a keystroke we can read
    const ime = await fakeTerm('')
    ime.handleInputEvent('退出')
    type(ime, 'exit')
    ime.handleInputEvent('\r')
    assert.equal(ime.userTypeExit, false)
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
