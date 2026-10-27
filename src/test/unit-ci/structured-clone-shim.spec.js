const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const shim = require('../../app/server/structured-clone-shim')
const { TerminalBase } = require('../../app/server/session-base')

const native = globalThis.structuredClone

// Electron 22 (every -legacy build) ships Node 16, where the global does not
// exist. Deleting it reproduces that runtime exactly.
function withoutNative (fn) {
  delete globalThis.structuredClone
  try {
    return fn()
  } finally {
    globalThis.structuredClone = native
  }
}

test('install() adds the global only when it is missing', () => {
  withoutNative(() => {
    assert.equal(typeof globalThis.structuredClone, 'undefined')
    assert.equal(shim.install(), true)
    assert.equal(typeof globalThis.structuredClone, 'function')
    // a second call must not replace the installed one
    const installed = globalThis.structuredClone
    assert.equal(shim.install(), false)
    assert.equal(globalThis.structuredClone, installed)
  })
  assert.equal(shim.install(), false)
  assert.equal(globalThis.structuredClone, native)
})

test('clone() copies the value model structuredClone is defined on', () => {
  const source = {
    str: 'a',
    num: 1,
    nil: null,
    nested: { list: [1, { deep: true }] },
    date: new Date(5),
    re: /ab/gi,
    map: new Map([[1, 'one']]),
    set: new Set(['x']),
    bytes: new Uint8Array([1, 2, 3]),
    big: 10n,
    undef: undefined
  }
  source.self = source
  const shared = { v: 1 }
  source.pair = [shared, shared]

  const copy = shim.clone(source)
  assert.notEqual(copy, source)
  assert.deepEqual(copy.nested, { list: [1, { deep: true }] })
  assert.equal(copy.self, copy)
  assert.equal(copy.pair[0], copy.pair[1])
  assert.ok(copy.date instanceof Date)
  assert.equal(copy.date.getTime(), 5)
  assert.equal(String(copy.re), '/ab/gi')
  assert.equal(copy.re.flags, 'gi')
  assert.equal(copy.map.get(1), 'one')
  assert.deepEqual([...copy.set], ['x'])
  assert.equal(copy.bytes.length, 3)
  assert.equal(copy.big, 10n)
  assert.ok('undef' in copy)

  // a real clone, not a shared reference
  copy.nested.list.push(2)
  assert.equal(source.nested.list.length, 2)
})

test('clone() rejects what structuredClone rejects', () => {
  assert.throws(() => shim.clone({ fn: () => 1 }), err => {
    assert.equal(err.name, 'DataCloneError')
    return true
  })
  assert.throws(() => shim.clone(Symbol('x')), err => {
    assert.equal(err.name, 'DataCloneError')
    return true
  })
  assert.throws(
    () => shim.clone(new Uint8Array(1), { transfer: [new ArrayBuffer(1)] }),
    err => {
      assert.equal(err.name, 'DataCloneError')
      return true
    }
  )
})

test('a terminal with logging on still starts without structuredClone (#4650)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-clone-shim-'))
  const file = path.join(dir, 'session.log')
  try {
    const text = await withoutNative(async () => {
      const term = new TerminalBase({
        cols: 80,
        rows: 24,
        logName: 'shim',
        sessionLogPath: dir
      })
      try {
        term.startTerminalLogFile(file, false)
        term.writeLog(Buffer.from('hello\r\nworld\r\n'))
        // xterm parses writes asynchronously; an empty write calls back after
        // them
        await new Promise(resolve => term._vtTerm.write('', resolve))
        await new Promise(resolve => term.sessionLogger.stream.end(resolve))
        return fs.readFileSync(file, 'utf8')
      } finally {
        term._vtTerm.dispose()
      }
    })
    assert.equal(text, 'hello\nworld\n')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
