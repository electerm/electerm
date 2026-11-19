/**
 * The "settings" item of the application menu has to carry the standard
 * platform shortcut (Cmd+, on macOS), otherwise the shortcut does nothing.
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

const menuPath = require.resolve('../../app/lib/menu')
const globalStatePath = require.resolve('../../app/lib/glob-state')

describe('application menu settings item', () => {
  const originalLoad = Module._load
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  let captured

  before(() => {
    const electronStub = {
      app: { name: 'electerm', dock: { setMenu () {} } },
      Menu: {
        buildFromTemplate (template) {
          captured = template
          return template
        }
      },
      shell: {}
    }
    Module._load = function (request, ...rest) {
      if (request === 'electron') {
        return electronStub
      }
      if (request === '../common/runtime-constants') {
        return { packInfo: { homepage: '' } }
      }
      return originalLoad.call(this, request, ...rest)
    }
    require(globalStatePath).set('translate', k => k)
    delete require.cache[menuPath]
  })

  after(() => {
    Module._load = originalLoad
    Object.defineProperty(process, 'platform', originalPlatform)
    delete require.cache[menuPath]
  })

  function findSettings (template) {
    for (const top of template) {
      const item = (top.submenu || []).find(d => d.label === 'settings')
      if (item) return item
    }
  }

  for (const platform of ['darwin', 'linux', 'win32']) {
    it(`settings shortcut on ${platform}`, () => {
      Object.defineProperty(process, 'platform', { value: platform })
      delete require.cache[menuPath]
      require(menuPath)()
      const item = findSettings(captured)
      assert.ok(item, 'settings item exists')
      // Cmd+, is the macOS convention; Ctrl+, is left to the terminal elsewhere
      assert.equal(item.accelerator, platform === 'darwin' ? 'Cmd+,' : undefined)
    })
  }
})
