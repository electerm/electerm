const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

// term-content.js has no imports, so it loads straight into node.
const loadMixin = async () => {
  const { contentMixin } = await import('../../client/components/terminal/mixins/term-content.js')
  return contentMixin
}

// A buffer stand-in: `rows` is either a string (a plain row) or
// { text, wrapped } for a row xterm reports as continuing the previous one.
function makeCtx (rows, over = {}) {
  const term = {
    buffer: {
      active: {
        length: rows.length,
        viewportY: 0,
        getLine: (i) => {
          const row = rows[i]
          if (row == null) {
            return null
          }
          const text = typeof row === 'string' ? row : row.text
          return {
            isWrapped: typeof row === 'string' ? false : !!row.wrapped,
            translateToString: (trim) => (trim ? text.trimEnd() : text)
          }
        }
      }
    }
  }
  return {
    term,
    state: {},
    ...over
  }
}

const withMixin = async (rows, over) => {
  const mixin = await loadMixin()
  const ctx = makeCtx(rows, over)
  for (const name of Object.keys(mixin)) {
    ctx[name] = mixin[name].bind(ctx)
  }
  return ctx
}

describe('term-content: getSelectableBufferText', () => {
  test('joins rows with newlines', async () => {
    const ctx = await withMixin(['hello', 'world'])
    assert.equal(ctx.getSelectableBufferText(), 'hello\nworld')
  })

  test('drops the blank rows scrollback starts with', async () => {
    const ctx = await withMixin(['', '   ', 'hello', '', '  '])
    assert.equal(ctx.getSelectableBufferText(), 'hello')
  })

  test('glues wrapped rows back into the line the shell printed', async () => {
    const ctx = await withMixin([
      'a very long line that th',
      { text: 'e terminal had to wrap', wrapped: true },
      'next line'
    ])
    assert.equal(
      ctx.getSelectableBufferText(),
      'a very long line that the terminal had to wrap\nnext line'
    )
  })

  test('does not glue the very first row even if it claims to wrap', async () => {
    const ctx = await withMixin([{ text: 'orphan', wrapped: true }])
    assert.equal(ctx.getSelectableBufferText(), 'orphan')
  })

  test('right-trims the padding every row is filled with', async () => {
    const ctx = await withMixin(['ps1 ', 'ls  '])
    assert.equal(ctx.getSelectableBufferText(), 'ps1\nls')
  })

  test('skips rows the buffer no longer has', async () => {
    const ctx = await withMixin(['hello', null, 'world'])
    assert.equal(ctx.getSelectableBufferText(), 'hello\nworld')
  })

  test('is empty for an all-blank buffer', async () => {
    const ctx = await withMixin(['', '   '])
    assert.equal(ctx.getSelectableBufferText(), '')
  })

  test('is empty for an empty buffer', async () => {
    const ctx = await withMixin([])
    assert.equal(ctx.getSelectableBufferText(), '')
  })
})
