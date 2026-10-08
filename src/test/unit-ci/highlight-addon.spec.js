const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadAddon = () => import('../../client/components/terminal/highlight-addon.js')

const RED = '\u001b[31m'
const GREEN = '\u001b[32m'
const RESET = '\u001b[0m'

function fakeTerminal () {
  const written = []
  return {
    written,
    displayRaw: false,
    write (data) { written.push(data) }
  }
}

describe('keyword highlight addon', () => {
  test('highlights writes larger than the per-line limit line by line', async () => {
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon([{ keyword: '\\bdown\\b', color: 'red' }])
    const term = fakeTerminal()
    addon.activate(term)

    // a coalesced `show running-config`-sized write: many short lines, > 4096 chars
    const lines = Array.from({ length: 400 }, (_, i) => `interface Gi1/0/${i} status down`)
    const chunk = lines.join('\r\n')
    assert.ok(chunk.length > addon.maxHighlightLength)
    term.write(chunk)

    const out = term.written[0]
    assert.equal(out.split(`${RED}down${RESET}`).length - 1, 400)
  })

  test('leaves a single over-long line unhighlighted but still highlights its neighbours', async () => {
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon([{ keyword: 'up', color: 'green' }])
    const longLine = 'up ' + 'x'.repeat(addon.maxHighlightLength + 10)
    const out = addon.highlightChunk(`link up\n${longLine}\nlink up`)
    const [first, middle, last] = out.split('\n')

    assert.equal(first, `link ${GREEN}up${RESET}`)
    assert.equal(middle, longLine)
    assert.equal(last, `link ${GREEN}up${RESET}`)
  })

  test('skips writes over the chunk cap entirely', async () => {
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon([{ keyword: 'down', color: 'red' }])
    const flood = 'down\n'.repeat(Math.ceil(addon.maxHighlightChunkLength / 5) + 1)
    assert.equal(addon.highlightChunk(flood), flood)
  })

  test('small writes behave as before', async () => {
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon([{ keyword: 'down', color: 'red' }])
    assert.equal(addon.highlightChunk('link down'), `link ${RED}down${RESET}`)
  })
})
