const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let getBookmarkIconUrl
before(async () => {
  ;({ getBookmarkIconUrl } = await import('../../client/common/bookmark-icon-url.js'))
})

describe('bookmark icon URLs', () => {
  test('accepts HTTPS SVG URLs, preserving query strings and fragments', () => {
    const url = 'https://cdn.example.com/server.svg?token=a%2Fb&size=32#logo'
    assert.equal(getBookmarkIconUrl(`  ${url}\n`), url)
  })

  test('accepts image services without a file extension', () => {
    assert.equal(getBookmarkIconUrl('https://example.com/icon?id=42'), 'https://example.com/icon?id=42')
  })

  test('rejects non-HTTPS, relative, malformed, and credential-bearing URLs', () => {
    for (const url of [
      'http://example.com/logo.svg',
      '//example.com/logo.svg',
      '/logo.svg',
      'file:///C:/logo.svg',
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      'https://',
      'https://[invalid]/logo.svg',
      'https://user:password@example.com/logo.svg',
      'https://user@example.com/logo.svg'
    ]) {
      assert.equal(getBookmarkIconUrl(url), '', url)
    }
  })

  test('old bookmarks and malformed imported fields fall back without throwing', () => {
    for (const value of [undefined, null, '', ' ', 123, false, {}, []]) {
      assert.equal(getBookmarkIconUrl(value), '')
    }
  })
})
