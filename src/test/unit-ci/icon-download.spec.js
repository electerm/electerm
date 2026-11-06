const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const {
  MAX_ICON_SIZE,
  detectExtension,
  saveIconFromUrl
} = require('../../app/lib/icon-download.js')

describe('icon download', () => {
  test('picks the extension from the content type first', () => {
    assert.equal(detectExtension('image/svg+xml', '/i', Buffer.from('')), 'svg')
    assert.equal(detectExtension('image/png; charset=binary', '/i.svg', Buffer.from('')), 'png')
    assert.equal(detectExtension('IMAGE/JPEG', '/i', Buffer.from('')), 'jpg')
    assert.equal(detectExtension('image/vnd.microsoft.icon', '/i', Buffer.from('')), 'ico')
  })

  test('falls back to the URL, then to the bytes', () => {
    assert.equal(
      detectExtension('application/octet-stream', '/a/logo.SVG', Buffer.from('')),
      'svg'
    )
    assert.equal(
      detectExtension('', '/a/logo', Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      'png'
    )
    assert.equal(
      detectExtension('', '/a/logo', Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')),
      'svg'
    )
    assert.equal(
      detectExtension('', '/a/logo', Buffer.from([0xff, 0xd8, 0xff])),
      'jpg'
    )
  })

  test('an unknown payload is stored as svg, the expected icon format', () => {
    assert.equal(detectExtension('', '/a/logo', Buffer.from([1, 2, 3])), 'svg')
  })

  test('only http(s) URLs reach the network', async () => {
    for (const value of ['file:///etc/passwd', 'data:image/svg+xml,<svg/>', 'javascript:alert(1)', '', '   ']) {
      await assert.rejects(() => saveIconFromUrl(value))
    }
  })

  test('size limit stays small enough to keep icons cheap to sync', () => {
    assert.equal(MAX_ICON_SIZE, 512 * 1024)
  })
})
