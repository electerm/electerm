const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let parseSearchKeywords
let hasSearchKeywords
let matchesSearchKeywords

before(async () => {
  const mod = await import('../../client/common/search-keywords.js')
  parseSearchKeywords = mod.parseSearchKeywords
  hasSearchKeywords = mod.hasSearchKeywords
  matchesSearchKeywords = mod.matchesSearchKeywords
})

describe('bookmark search keywords', () => {
  test('splits the query on whitespace', () => {
    assert.deepStrictEqual(parseSearchKeywords('  139\thu  '), {
      include: ['139', 'hu'],
      exclude: []
    })
  })

  test('supports negative terms', () => {
    assert.deepStrictEqual(parseSearchKeywords('139 !hu'), {
      include: ['139'],
      exclude: ['hu']
    })
  })

  test('supports a query with only negative terms', () => {
    const parsed = parseSearchKeywords('!test')
    assert.deepStrictEqual(parsed, {
      include: [],
      exclude: ['test']
    })
    assert.equal(hasSearchKeywords(parsed), true)
    assert.equal(matchesSearchKeywords('hubei', parsed), true)
    assert.equal(matchesSearchKeywords('test-server', parsed), false)
  })

  test('an escaped ! is matched literally', () => {
    const parsed = parseSearchKeywords('\\!hu')
    assert.deepStrictEqual(parsed, {
      include: ['!hu'],
      exclude: []
    })
    assert.equal(matchesSearchKeywords('a !hu b', parsed), true)
    assert.equal(matchesSearchKeywords('a hu b', parsed), false)
  })

  test('requires every positive term and no negative term', () => {
    const text = '10.139 home/dky/hubei - root@192.168.9.44'
    assert.equal(
      matchesSearchKeywords(text, parseSearchKeywords('139 hu')),
      true
    )
    assert.equal(
      matchesSearchKeywords(text, parseSearchKeywords('139 !hu')),
      false
    )
    assert.equal(
      matchesSearchKeywords(text, parseSearchKeywords('139 !jiangxi')),
      true
    )
  })

  test('is case-insensitive', () => {
    assert.equal(
      matchesSearchKeywords('Hubei', parseSearchKeywords('hu')),
      true
    )
    assert.equal(
      matchesSearchKeywords('Hubei', parseSearchKeywords('!HU')),
      false
    )
  })

  test('an empty query has no keywords', () => {
    const parsed = parseSearchKeywords('   ')
    assert.deepStrictEqual(parsed, {
      include: [],
      exclude: []
    })
    assert.equal(hasSearchKeywords(parsed), false)
    assert.equal(matchesSearchKeywords('anything', parsed), true)
  })
})
