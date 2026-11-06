const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let parseIcon
let normalizeIcon
let iconMimeType
let builtinIconValue

before(async () => {
  ;({
    parseIcon,
    normalizeIcon,
    iconMimeType,
    builtinIconValue
  } = await import('../../client/common/icon-value.js'))
})

describe('bookmark icon values', () => {
  test('built-in icons are stored as icon:<name>', () => {
    assert.deepEqual(parseIcon('icon:ubuntu'), { type: 'builtin', name: 'ubuntu' })
    assert.deepEqual(parseIcon('  icon:rocky-linux\n'), { type: 'builtin', name: 'rocky-linux' })
    assert.equal(builtinIconValue('k8s'), 'icon:k8s')
  })

  test('absolute local paths are accepted, on every platform', () => {
    assert.deepEqual(parseIcon('/home/u/icons/a.svg'), { type: 'file', path: '/home/u/icons/a.svg' })
    assert.deepEqual(parseIcon('C:\\icons\\a.png'), { type: 'file', path: 'C:\\icons\\a.png' })
    assert.deepEqual(parseIcon('\\\\nas\\icons\\a.png'), { type: 'file', path: '\\\\nas\\icons\\a.png' })
  })

  test('a remote URL is never rendered, so a synced bookmark cannot make us fetch it', () => {
    for (const value of [
      'https://example.com/logo.svg',
      'http://example.com/logo.svg',
      '//example.com/logo.svg',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      'Icon:Ubuntu',
      'icon:',
      'icon:../etc/passwd',
      'icon:Ubuntu'
    ]) {
      assert.equal(parseIcon(value), null, value)
    }
  })

  test('garbage falls back to no icon instead of throwing', () => {
    for (const value of [undefined, null, '', '   ', 123, false, {}, []]) {
      assert.equal(parseIcon(value), null)
      assert.equal(normalizeIcon(value), '')
    }
  })

  test('normalize keeps the canonical value and drops everything else', () => {
    assert.equal(normalizeIcon(' icon:ubuntu '), 'icon:ubuntu')
    assert.equal(normalizeIcon('/opt/icons/a.svg'), '/opt/icons/a.svg')
    assert.equal(normalizeIcon('https://example.com/a.svg'), '')
  })

  test('mime type follows the file extension, svg by default', () => {
    assert.equal(iconMimeType('/a/b.svg'), 'image/svg+xml')
    assert.equal(iconMimeType('/a/b.PNG'), 'image/png')
    assert.equal(iconMimeType('/a/b.jpeg'), 'image/jpeg')
    assert.equal(iconMimeType('/a/b.ico'), 'image/x-icon')
    assert.equal(iconMimeType('/a/b.unknown'), 'image/svg+xml')
    assert.equal(iconMimeType(''), 'image/svg+xml')
  })
})
