const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

// term-touch.js reads `window.store.isTouchDevice` at call time and builds a
// MouseEvent for the context-menu dispatch, so both need to exist in node.
global.MouseEvent = global.MouseEvent || class {
  constructor (type, init = {}) {
    this.type = type
    Object.assign(this, init)
  }
}

const loadMixin = async () => {
  const { touchMixin } = await import('../../client/components/terminal/mixins/term-touch.js')
  // onSelectTextMode() reads the buffer through getSelectableBufferText(),
  // which lives in term-content.js — also import-free, so it loads here too
  const { contentMixin } = await import('../../client/components/terminal/mixins/term-content.js')
  return { ...contentMixin, ...touchMixin }
}

const SCREEN_RECT = {
  left: 0,
  top: 0,
  right: 800,
  bottom: 480,
  width: 800,
  height: 480
}

// 80 cols × 24 rows across 800×480 px → 10px wide, 20px tall cells, which makes
// the expected column/row of a touch point obvious.
function makeTerm (over = {}) {
  const selects = []
  const lines = {}
  return {
    selects,
    lines,
    cols: 80,
    rows: 24,
    select: (col, row, length) => selects.push([col, row, length]),
    selectLines: (start, end) => selects.push(['lines', start, end]),
    hasSelection: () => false,
    clearSelection: () => {},
    focus: () => {},
    buffer: {
      active: {
        viewportY: 0,
        getLine: (row) => lines[row]
      }
    },
    element: {
      querySelector: () => ({
        getBoundingClientRect: () => SCREEN_RECT
      })
    },
    ...over
  }
}

// Mirrors applyMixins (see mixins/index.js), plus the per-instance fields that
// terminal.jsx owns.
async function makeCtx (over = {}) {
  const mixin = await loadMixin()
  const ctx = {
    term: makeTerm(),
    props: { config: {} },
    state: {
      loading: false,
      // the initial state terminal.jsx declares
      selectTextVisible: false,
      selectTextContent: ''
    },
    timers: {},
    longPressTimer: null,
    touchStartPos: null,
    longPressFired: false,
    longPressThreshold: 500,
    longPressMoveTolerance: 12,
    dragSelect: null,
    lastDragTouch: null,
    autoScrollDir: 0,
    dragFrame: 0,
    tapCount: 0,
    lastTapTime: 0,
    lastTapPos: null,
    // owned by terminal.jsx
    selectTextRef: { current: null },
    setState: (s) => {
      Object.assign(ctx.state, s)
    },
    // lives in contextMenuMixin (term-context-menu.jsx), which pulls in antd
    // and so cannot be imported here
    copied: [],
    copyToClipboard: (txt) => {
      ctx.copied.push(txt)
    },
    ...over
  }
  for (const name of Object.keys(mixin)) {
    ctx[name] = mixin[name].bind(ctx)
  }
  return ctx
}

// Installs the window bits term-touch.js reaches for: the store flag it gates
// on, plus a requestAnimationFrame that runs its frame synchronously so a
// coalesced drag update is observable without waiting on a real frame.
const setTouchDevice = (isTouchDevice) => {
  global.window = global.window || {}
  global.window.store = { isTouchDevice }
  global.window.requestAnimationFrame = (fn) => {
    fn()
    return 1
  }
  global.window.cancelAnimationFrame = () => {}
}

const touch = (clientX, clientY) => ({
  touches: [{ clientX, clientY }],
  changedTouches: [{ clientX, clientY }],
  currentTarget: { id: 'term-wrap' },
  stopPropagation: () => {}
})

describe('term-touch: store.isTouchDevice gate', () => {
  test('a mouse-driven desktop never starts a gesture', async () => {
    setTouchDevice(false)
    const ctx = await makeCtx()
    ctx.onTouchStart(touch(10, 10))
    assert.equal(ctx.touchStartPos, null)
    assert.equal(ctx.longPressTimer, null)
    assert.equal(ctx.longPressFired, false)
  })

  test('touch mode arms the long press timer', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.onTouchStart(touch(10, 20))
    assert.equal(ctx.touchStartPos.clientX, 10)
    assert.equal(ctx.touchStartPos.clientY, 20)
    assert.ok(ctx.longPressTimer)
    clearTimeout(ctx.longPressTimer)
  })

  test('a second finger aborts the gesture so xterm keeps pinch/scroll', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.onTouchStart(touch(10, 20))
    ctx.onTouchStart({ touches: [{}, {}], currentTarget: {} })
    assert.equal(ctx.touchStartPos, null)
    assert.equal(ctx.longPressTimer, null)
  })

  test('no handler does anything without a gesture in flight', async () => {
    setTouchDevice(false)
    const ctx = await makeCtx()
    ctx.onTouchMove(touch(10, 10))
    ctx.onTouchEnd(touch(10, 10))
    assert.deepEqual(ctx.term.selects, [])
  })
})

describe('term-touch: coordinate mapping', () => {
  test('maps a client point to a cell and adds the scrollback offset', async () => {
    const ctx = await makeCtx()
    const coords = ctx.toBufferCoords(15, 45)
    // 15/10 → col 1, 45/20 → viewport row 2
    assert.equal(coords.col, 1)
    assert.equal(coords.absRow, 2)
    assert.equal(coords.beyond, 0)
  })

  test('reports the buffer-absolute row once scrolled back', async () => {
    const term = makeTerm()
    term.buffer.active.viewportY = 100
    const ctx = await makeCtx({ term })
    const coords = ctx.toBufferCoords(15, 45)
    // the regression: the viewport row is 2, but the selection model wants the
    // absolute buffer line
    assert.equal(coords.absRow, 102)
  })

  test('flags the auto-scroll direction past the top and bottom edges', async () => {
    const ctx = await makeCtx()
    assert.equal(ctx.toBufferCoords(15, -30).beyond, -1)
    assert.equal(ctx.toBufferCoords(15, 600).beyond, 1)
  })

  test('clamps out-of-range points into the grid', async () => {
    const ctx = await makeCtx()
    const coords = ctx.toBufferCoords(5000, -30)
    assert.equal(coords.col, 79)
    assert.equal(coords.absRow, 0)
  })

  test('gives up when the terminal has no element yet', async () => {
    const ctx = await makeCtx({ term: { cols: 80, rows: 24 } })
    assert.equal(ctx.toBufferCoords(15, 45), null)
  })
})

describe('term-touch: word selection', () => {
  test('selects the word on the buffer-absolute line', async () => {
    const term = makeTerm()
    term.buffer.active.viewportY = 100
    term.buffer.active.getLine = (row) => {
      assert.equal(row, 101)
      return { translateToString: () => 'hello world' }
    }
    const ctx = await makeCtx({ term })
    const anchor = ctx.selectWordAt(15, 25)
    assert.deepEqual(ctx.term.selects, [[0, 101, 5]])
    assert.deepEqual(anchor, { col: 0, absRow: 101 })
  })

  test('selects nothing on a separator but still returns an anchor', async () => {
    const term = makeTerm()
    term.buffer.active.getLine = () => ({ translateToString: () => 'hello world' })
    const ctx = await makeCtx({ term })
    // col 5 is the space between the two words
    const anchor = ctx.selectWordAt(55, 25)
    assert.deepEqual(ctx.term.selects, [])
    assert.deepEqual(anchor, { col: 5, absRow: 1 })
  })

  test('splits words on the default separator set', async () => {
    const term = makeTerm()
    term.buffer.active.getLine = () => ({ translateToString: () => 'a.b.c' })
    const ctx = await makeCtx({ term })
    // a dot separates by default, so col 2 is the single-char word "b"
    assert.deepEqual(ctx.selectWordAt(25, 25), { col: 2, absRow: 1 })
    assert.deepEqual(ctx.term.selects, [[2, 1, 1]])
  })

  test('honours a custom terminalWordSeparator', async () => {
    const term = makeTerm()
    term.buffer.active.getLine = () => ({ translateToString: () => 'a.b.c' })
    const ctx = await makeCtx({
      term,
      props: { config: { terminalWordSeparator: ' ' } }
    })
    // with only a space as separator the whole "a.b.c" is one word
    assert.deepEqual(ctx.selectWordAt(25, 25), { col: 0, absRow: 1 })
    assert.deepEqual(ctx.term.selects, [[0, 1, 5]])
  })
})

describe('term-touch: selection range math', () => {
  test('builds the multi-line length xterm expects', async () => {
    const ctx = await makeCtx()
    ctx.applySelection({ col: 10, absRow: 5 }, { col: 14, absRow: 7 })
    // cols * (endY - startY) + (endX - startX + 1)
    assert.deepEqual(ctx.term.selects, [[10, 5, 80 * 2 + 5]])
    // and that length must decode back to the exclusive end cell
    const [col, row, length] = ctx.term.selects[0]
    const i = col + length
    assert.equal(i % 80, 15)
    assert.equal(row + Math.floor(i / 80), 7)
  })

  test('normalises a backwards drag, since select() takes start + length', async () => {
    const ctx = await makeCtx()
    ctx.applySelection({ col: 14, absRow: 7 }, { col: 10, absRow: 5 })
    assert.deepEqual(ctx.term.selects, [[10, 5, 80 * 2 + 5]])
  })

  test('handles a backwards drag inside one line', async () => {
    const ctx = await makeCtx()
    ctx.applySelection({ col: 3, absRow: 9 }, { col: 0, absRow: 9 })
    assert.deepEqual(ctx.term.selects, [[0, 9, 4]])
  })

  test('a zero-width drag still selects the single cell', async () => {
    const ctx = await makeCtx()
    ctx.applySelection({ col: 4, absRow: 2 }, { col: 4, absRow: 2 })
    assert.deepEqual(ctx.term.selects, [[4, 2, 1]])
  })

  test('does nothing without an anchor', async () => {
    const ctx = await makeCtx()
    ctx.applySelection(null, { col: 1, absRow: 1 })
    assert.deepEqual(ctx.term.selects, [])
  })
})

describe('term-touch: releasing a drag', () => {
  const startDrag = async (config) => {
    setTouchDevice(true)
    const term = makeTerm()
    term.buffer.active.getLine = () => ({ translateToString: () => 'hello world' })
    const dispatched = []
    const ctx = await makeCtx({
      term,
      props: { config }
    })
    ctx.copied = 0
    ctx.copySelectionToClipboard = () => { ctx.copied++ }
    ctx.touchStartPos = {
      clientX: 15,
      clientY: 25,
      target: { dispatchEvent: (ev) => dispatched.push(ev.type) }
    }
    ctx.handleLongPress()
    ctx.onTouchMove(touch(200, 45))
    return { ctx, dispatched }
  }

  test('copies once on release when copyWhenSelect is on', async () => {
    const { ctx, dispatched } = await startDrag({ copyWhenSelect: true })
    ctx.onTouchEnd(touch(200, 45))
    assert.equal(ctx.copied, 1)
    assert.deepEqual(dispatched, [])
    assert.equal(ctx.dragSelect, null)
  })

  test('offers the menu instead when copyWhenSelect is off', async () => {
    const { ctx, dispatched } = await startDrag({})
    ctx.onTouchEnd(touch(200, 45))
    assert.equal(ctx.copied, 0)
    assert.deepEqual(dispatched, ['contextmenu'])
  })

  test('a long press without a drag still opens the menu', async () => {
    const { ctx, dispatched } = await startDrag({})
    assert.deepEqual(dispatched, [])
    ctx.onTouchEnd(touch(15, 25))
    assert.equal(ctx.copied, 0)
    assert.deepEqual(dispatched, ['contextmenu'])
  })

  test('pasteWhenContextMenu keeps long press meaning paste', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx({ props: { config: { pasteWhenContextMenu: true } } })
    ctx.pasted = 0
    ctx.onPaste = () => { ctx.pasted++ }
    ctx.touchStartPos = { clientX: 15, clientY: 25, target: {} }
    ctx.handleLongPress()
    assert.equal(ctx.pasted, 1)
    // no drag is started, so the gesture stays out of the selection path
    assert.equal(ctx.dragSelect, null)
  })
})

describe('term-touch: select-text overlay', () => {
  const fakeTextarea = (value, selectionStart = 0, selectionEnd = 0) => {
    const el = {
      value,
      selectionStart,
      selectionEnd,
      focused: 0,
      range: null,
      focus () {
        el.focused++
      },
      setSelectionRange (a, b) {
        el.range = [a, b]
      }
    }
    return el
  }

  const bufferTerm = (rows) => {
    const term = makeTerm()
    term.buffer.active.length = rows.length
    term.buffer.active.getLine = (i) => {
      const row = rows[i]
      return row == null
        ? null
        : { translateToString: () => row }
    }
    return term
  }

  test('a touch inside the overlay never starts a terminal gesture', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.onTouchStart({
      ...touch(10, 10),
      target: { closest: () => true }
    })
    assert.equal(ctx.touchStartPos, null)
    assert.equal(ctx.longPressTimer, null)
  })

  test('a touch elsewhere still starts a gesture', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.onTouchStart({ ...touch(10, 10), target: { closest: () => null } })
    assert.ok(ctx.touchStartPos)
    clearTimeout(ctx.longPressTimer)
  })

  test('tolerates a touch target without closest()', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.onTouchStart(touch(10, 10))
    assert.ok(ctx.touchStartPos)
    clearTimeout(ctx.longPressTimer)
  })

  test('opens the overlay with a snapshot of the buffer', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx({
      term: bufferTerm(['hello', 'world'])
    })
    ctx.onSelectTextMode()
    assert.equal(ctx.state.selectTextVisible, true)
    assert.equal(ctx.state.selectTextContent, 'hello\nworld')
  })

  test('does not open on an empty buffer', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx({ term: bufferTerm(['', '  ']) })
    ctx.onSelectTextMode()
    assert.equal(ctx.state.selectTextVisible, false)
    assert.equal(ctx.state.selectTextContent, '')
  })

  test('closing drops the snapshot', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.state.selectTextVisible = true
    ctx.state.selectTextContent = 'hello'
    ctx.handleSelectTextClose()
    assert.equal(ctx.state.selectTextVisible, false)
    assert.equal(ctx.state.selectTextContent, '')
  })

  test('copies just the selection when the user made one', async () => {
    setTouchDevice(true)
    const el = fakeTextarea('hello\nworld', 6, 11)
    const ctx = await makeCtx({ selectTextRef: { current: el } })
    ctx.handleSelectTextCopy()
    assert.deepEqual(ctx.copied, ['world'])
  })

  test('copies the whole snapshot when nothing is selected', async () => {
    setTouchDevice(true)
    const el = fakeTextarea('hello\nworld')
    const ctx = await makeCtx({ selectTextRef: { current: el } })
    ctx.handleSelectTextCopy()
    assert.deepEqual(ctx.copied, ['hello\nworld'])
  })

  test('does nothing when the overlay is not mounted', async () => {
    setTouchDevice(true)
    const ctx = await makeCtx()
    ctx.handleSelectTextCopy()
    ctx.handleSelectTextAll()
    assert.deepEqual(ctx.copied, [])
  })

  test('select all covers the whole snapshot', async () => {
    setTouchDevice(true)
    const el = fakeTextarea('hello\nworld')
    const ctx = await makeCtx({ selectTextRef: { current: el } })
    ctx.handleSelectTextAll()
    // read-only, so focusing cannot raise the soft keyboard, but browsers will
    // not paint a selection on an unfocused element
    assert.equal(el.focused, 1)
    assert.deepEqual(el.range, [0, 11])
  })
})
