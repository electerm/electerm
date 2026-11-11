const { describe, test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/common/web-url.js')

describe('webUrl', () => {
  beforeEach(() => {
    global.window = {}
  })

  test('uses the host resolver when the web build injected one', async () => {
    const { webUrl } = await load()
    global.window.et = {
      basePath: '/electerm',
      url: p => '/electerm' + p
    }
    assert.equal(webUrl('/api/widget-ui/x'), '/electerm/api/widget-ui/x')
  })

  test('falls back to basePath on a host build without the resolver', async () => {
    const { webUrl } = await load()
    global.window.et = { basePath: '/electerm' }
    assert.equal(webUrl('/api/x'), '/electerm/api/x')
  })

  test('is a pass-through on the desktop app', async () => {
    const { webUrl } = await load()
    global.window.et = {}
    assert.equal(webUrl('/icons/'), '/icons/')
    assert.equal(webUrl(''), '')
  })
})
