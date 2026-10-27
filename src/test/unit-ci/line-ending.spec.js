process.env.NODE_ENV = 'development'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const { createRxConverter, convertTx } = require('../../app/server/line-ending')

// Feed a whole stream through the converter one chunk at a time, so the
// chunk-boundary behaviour can be exercised without a real socket.
function convertInChunks (mode, chunks) {
  const convert = createRxConverter(mode)
  return chunks.map(chunk => convert(chunk)).join('')
}

describe('line-ending rx conversion', () => {
  test('no converter when the mode is none or unknown', () => {
    assert.equal(createRxConverter('none'), null)
    assert.equal(createRxConverter(undefined), null)
    assert.equal(createRxConverter(''), null)
    assert.equal(createRxConverter('not_a_mode'), null)
  })

  test('lf_to_crlf turns bare LF into CRLF', () => {
    assert.equal(convertInChunks('lf_to_crlf', ['one\ntwo\n']), 'one\r\ntwo\r\n')
  })

  test('lf_to_crlf leaves an existing CRLF alone', () => {
    assert.equal(convertInChunks('lf_to_crlf', ['one\r\ntwo\r\n']), 'one\r\ntwo\r\n')
  })

  test('lf_to_crlf does not double a CRLF split across two chunks', () => {
    assert.equal(convertInChunks('lf_to_crlf', ['one\r', '\ntwo']), 'one\r\ntwo')
    // and the state must not leak into the next line
    assert.equal(convertInChunks('lf_to_crlf', ['one\r', '\ntwo\nthree']), 'one\r\ntwo\r\nthree')
  })

  test('lf_to_crlf leaves a lone CR alone', () => {
    assert.equal(convertInChunks('lf_to_crlf', ['progress\rdone']), 'progress\rdone')
  })

  test('cr_to_crlf turns bare CR into CRLF', () => {
    assert.equal(convertInChunks('cr_to_crlf', ['one\rtwo\r']), 'one\r\ntwo\r\n')
  })

  test('cr_to_crlf leaves an existing CRLF alone', () => {
    assert.equal(convertInChunks('cr_to_crlf', ['one\r\ntwo\r\n']), 'one\r\ntwo\r\n')
  })

  test('cr_to_crlf does not add a second line ending for a CRLF split across chunks', () => {
    // The regression this guards: converting each chunk on its own turned
    // "one\r" + "\ntwo" into "one\r\n\ntwo" - one extra blank line per split
    assert.equal(convertInChunks('cr_to_crlf', ['one\r', '\ntwo']), 'one\r\ntwo')
    assert.equal(convertInChunks('cr_to_crlf', ['one\r', '\ntwo\r', '\nthree']), 'one\r\ntwo\r\nthree')
  })

  test('cr_to_crlf collapses a run of CRs into one line ending', () => {
    // A device tty with onlcr writes \r\n as \r\r\n
    assert.equal(convertInChunks('cr_to_crlf', ['one\r\r\ntwo']), 'one\r\ntwo')
    assert.equal(convertInChunks('cr_to_crlf', ['one\r', '\r', '\ntwo']), 'one\r\ntwo')
  })

  test('cr_to_crlf emits a CR that ends the chunk instead of holding it back', () => {
    // Holding it until the next chunk would mean a device that sends a bare
    // CR and then waits loses it; the cursor would never return to column 0
    assert.equal(convertInChunks('cr_to_crlf', ['one\r']), 'one\r\n')
    assert.equal(convertInChunks('cr_to_crlf', ['one\r', '\n']), 'one\r\n')
  })

  test('cr_to_crlf also fixes a bare LF', () => {
    // Not what the mode is named for, but a device that mixes both kinds
    // should still end up with one line ending per line
    assert.equal(convertInChunks('cr_to_crlf', ['one\ntwo\n']), 'one\r\ntwo\r\n')
  })

  test('cr_to_crlf keeps one line ending per line across arbitrary chunk splits', () => {
    const stream = 'a\r\nb\rc\r\rd\n'
    const expected = 'a\r\nb\r\nc\r\nd\r\n'
    for (let size = 1; size <= stream.length; size++) {
      const chunks = []
      for (let i = 0; i < stream.length; i += size) {
        chunks.push(stream.slice(i, i + size))
      }
      // A trailing CR run is held until the next chunk, so compare against
      // the same stream with one extra empty chunk flushing nothing
      assert.equal(
        convertInChunks('cr_to_crlf', chunks),
        expected,
        `chunk size ${size}`
      )
    }
  })
})

describe('line-ending tx conversion', () => {
  test('CR is the no-op default', () => {
    assert.equal(convertTx('a\nb', '\r'), 'a\nb')
    assert.equal(convertTx('a\r\nb', '\r'), 'a\r\nb')
    assert.equal(convertTx('a\rb', undefined), 'a\rb')
  })

  test('CRLF rewrites every kind of line ending', () => {
    assert.equal(convertTx('a\nb', '\r\n'), 'a\r\nb')
    assert.equal(convertTx('a\rb', '\r\n'), 'a\r\nb')
    assert.equal(convertTx('a\r\nb', '\r\n'), 'a\r\nb')
    assert.equal(convertTx('a\r\nb\rc\nd', '\r\n'), 'a\r\nb\r\nc\r\nd')
  })

  test('LF rewrites CR and CRLF', () => {
    assert.equal(convertTx('a\rb', '\n'), 'a\nb')
    assert.equal(convertTx('a\r\nb', '\n'), 'a\nb')
  })

  test('a paste with mixed line endings ends up with one kind', () => {
    assert.equal(convertTx('1\r\n2\r3\n4', '\r\n'), '1\r\n2\r\n3\r\n4')
  })
})
