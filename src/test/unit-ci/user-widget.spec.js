const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// User widgets: a folder in DATA_PATH/widgets/<id>/ with a package.json.
// DATA_PATH is set before the modules load, so the widgets root lands in a temp
// dir instead of the developer's real app data.

let tmp
let widgetsRoot
let registry
let userWidget

function writeWidget (id, pkg, files = {}, root) {
  const dir = path.join(root || widgetsRoot, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  Object.entries(files).forEach(([name, content]) => {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  })
  return dir
}

const simplePkg = (extra = {}) => ({
  name: 'hello-widget',
  version: '1.2.3',
  description: 'greets',
  main: 'main.js',
  ...extra
})

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-test-'))
  widgetsRoot = path.join(tmp, 'widgets')
  process.env.DATA_PATH = tmp
  registry = require('../../app/widgets/load-widget')
  userWidget = require('../../app/widgets/user-widget')
})

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  delete process.env.DATA_PATH
})

describe('user widget registry', () => {
  it('lists a widget from its package.json without running it', () => {
    writeWidget('hello-widget', {
      ...simplePkg(),
      electerm: {
        name: 'Hello Widget',
        type: 'once',
        configs: [{ name: 'text', type: 'string', default: 'hi' }]
      }
    }, {
      'main.js': 'throw new Error("listing must not execute widget code")\n'
    })

    const widget = registry.listWidgets().find(w => w.id === 'hello-widget')
    assert.ok(widget)
    assert.equal(widget.builtin, false)
    assert.equal(widget.state, 'ok')
    assert.equal(widget.info.name, 'Hello Widget')
    assert.equal(widget.info.version, '1.2.3')
    assert.equal(widget.info.type, 'once')
    assert.deepEqual(widget.info.configs.map(c => c.name), ['text'])
  })

  it('ignores a folder that has no package.json', () => {
    fs.mkdirSync(path.join(tmp, 'widgets', 'notes'), { recursive: true })
    const ids = registry.listWidgets().map(w => w.id)
    assert.equal(ids.includes('notes'), false)
  })

  it('keeps a broken widget visible as an error entry', () => {
    writeWidget('broken-widget', {
      name: 'other-name',
      electerm: { id: 'not-the-folder-name' }
    }, { 'index.js': '' })

    const widget = registry.listWidgets().find(w => w.id === 'broken-widget')
    assert.ok(widget)
    assert.equal(widget.state, 'error')
    assert.match(widget.error, /does not match its folder name/)
    // the form still gets a usable shape, so the panel can render the error
    assert.deepEqual(widget.info.configs, [])
  })

  it('refuses to shadow a built-in id', () => {
    writeWidget('mcp-server', { name: 'mcp-server' }, { 'index.js': '' })

    const list = registry.listWidgets()
    const builtin = list.find(w => w.id === 'mcp-server')
    assert.equal(builtin.builtin, true)
    assert.match(builtin.warning, /belongs to a built-in widget/)
    assert.equal(list.filter(w => w.id === 'mcp-server').length, 1)
  })

  it('reads the ui entry and defaults a ui widget to frontend', () => {
    writeWidget('ui-widget', { ...simplePkg({ name: 'ui-widget' }), electerm: { ui: 'ui/index.html' } }, {
      'main.js': '',
      'ui/index.html': '<html><body>hi</body></html>'
    })
    const widget = registry.listWidgets().find(w => w.id === 'ui-widget')
    assert.equal(widget.state, 'ok')
    assert.equal(widget.info.type, 'frontend')
    assert.equal(widget.info.ui, 'ui/index.html')
  })

  it('rejects a main entry outside the widget folder', () => {
    writeWidget('escaping-widget', { ...simplePkg(), main: '../main.js' }, {})
    const widget = registry.listWidgets().find(w => w.id === 'escaping-widget')
    assert.equal(widget.state, 'error')
    assert.match(widget.error, /must stay inside the widget folder/)
  })
})

describe('callWidgetFunc', () => {
  it('calls an exported function and passes arguments through', async () => {
    writeWidget('call-widget', simplePkg(), {
      'main.js': 'module.exports = { add: (a, b) => a + b, widgetInfo: {} }\n'
    })
    assert.equal(await registry.callWidgetFunc('call-widget', 'add', 2, 3), 5)
  })

  it('refuses anything that is not an own function', async () => {
    writeWidget('call-widget', simplePkg(), {
      'main.js': 'module.exports = { add: (a, b) => a + b, widgetInfo: {} }\n'
    })
    await assert.rejects(
      () => registry.callWidgetFunc('call-widget', 'constructor'),
      /does not export the function/
    )
    await assert.rejects(
      () => registry.callWidgetFunc('call-widget', 'widgetInfo'),
      /does not export the function/
    )
  })
})

describe('runWidget', () => {
  it('runs a user frontend widget without a widgetRun', async () => {
    writeWidget('ui-widget', { ...simplePkg({ name: 'ui-widget' }), electerm: { ui: 'ui/index.html' } }, {
      'main.js': 'module.exports = {}\n',
      'ui/index.html': '<html></html>'
    })
    const result = await registry.runWidget('ui-widget', {})
    assert.deepEqual(result, { success: true })
  })

  it('rejects a traversed widget id', async () => {
    await assert.rejects(
      () => registry.runWidget('../../../../tmp/evil', {}),
      /Invalid widget ID/
    )
  })
})

describe('config mode metadata', () => {
  it('sanitizes config entries and defaults the action to run', () => {
    writeWidget('form-widget', {
      name: 'form-widget',
      main: 'main.js',
      electerm: {
        id: 'form-widget',
        type: 'frontend',
        submitLabel: 'Search',
        persist: true,
        configs: [
          { name: 'serverUrl', label: 'Server URL', type: 'string', required: true },
          { name: 'passphrase', type: 'password' },
          {
            name: 'keyPath',
            type: 'file',
            filters: [{ name: 'GPG keys', extensions: ['asc', 'gpg'] }]
          },
          { name: 'mode', type: 'select', choices: ['a', { label: 'B', value: 'b' }] },
          { name: 'weird', type: 'not-a-type', onClick: 'alert(1)' }
        ]
      }
    }, { 'main.js': 'module.exports = {}\n' })

    const widget = registry.listWidgets().find(w => w.id === 'form-widget')
    assert.equal(widget.state, 'ok')
    assert.equal(widget.info.type, 'frontend')
    assert.equal(widget.info.ui, '')
    assert.equal(widget.info.action, 'run')
    assert.equal(widget.info.submitLabel, 'Search')
    assert.equal(widget.info.persist, true)

    const [url, pass, key, mode, weird] = widget.info.configs
    assert.equal(url.label, 'Server URL')
    assert.equal(url.required, true)
    assert.equal(pass.type, 'password')
    assert.deepEqual(key.filters, [{ name: 'GPG keys', extensions: ['asc', 'gpg'] }])
    assert.deepEqual(mode.choices, [
      { label: 'a', value: 'a' },
      { label: 'B', value: 'b' }
    ])
    // unknown field type falls back, and unknown props are not copied
    assert.equal(weird.type, 'string')
    assert.equal(weird.onClick, undefined)
    // label defaults to the storage key when the manifest omits one
    assert.equal(pass.label, 'passphrase')
  })

  it('falls back to run for an unsafe action name', () => {
    writeWidget('bad-action', {
      name: 'bad-action',
      main: 'main.js',
      electerm: { id: 'bad-action', type: 'frontend', action: 'run(); whatever' }
    }, { 'main.js': 'module.exports = {}\n' })
    const widget = registry.listWidgets().find(w => w.id === 'bad-action')
    assert.equal(widget.info.action, 'run')
  })
})

describe('import and delete', () => {
  const sourcePkg = {
    name: 'Imported Widget',
    version: '0.1.0',
    description: 'copied whole',
    main: 'main.js',
    electerm: { id: 'imported-widget', type: 'frontend', ui: 'ui/index.html' }
  }

  function makeSource () {
    const dir = path.join(tmp, 'incoming')
    fs.rmSync(dir, { recursive: true, force: true })
    writeWidget('incoming', sourcePkg, {
      'main.js': 'module.exports = {}\n',
      'ui/index.html': '<html><body>imported</body></html>',
      'ui/app.js': 'console.log(1)\n'
    }, tmp)
    return dir
  }

  it('copies the whole folder, nested files included', async () => {
    const from = makeSource()
    const result = await registry.importWidget(from)
    assert.equal(result.id, 'imported-widget')

    const target = path.join(tmp, 'widgets', 'imported-widget')
    assert.ok(fs.existsSync(path.join(target, 'package.json')))
    assert.ok(fs.existsSync(path.join(target, 'ui', 'index.html')))
    assert.ok(fs.existsSync(path.join(target, 'ui', 'app.js')))

    const widget = registry.listWidgets().find(w => w.id === 'imported-widget')
    assert.equal(widget.state, 'ok')
    assert.equal(widget.info.ui, 'ui/index.html')
  })

  it('asks before replacing an installed widget', async () => {
    makeSource()
    const again = await registry.importWidget(path.join(tmp, 'incoming'))
    assert.deepEqual(again, { id: 'imported-widget', needOverwrite: true })

    const forced = await registry.importWidget(path.join(tmp, 'incoming'), true)
    assert.equal(forced.success, true)
  })

  it('refuses a folder without package.json', async () => {
    const dir = path.join(tmp, 'not-a-widget')
    fs.mkdirSync(dir, { recursive: true })
    assert.throws(
      () => registry.importWidget(dir),
      /package.json/
    )
  })

  it('does not import a folder that would not load', async () => {
    const dir = path.join(tmp, 'incoming-broken')
    writeWidget('incoming-broken', {
      name: 'incoming-broken',
      main: 'missing.js',
      electerm: { id: 'incoming-broken' }
    }, {}, tmp)
    assert.throws(
      () => registry.importWidget(dir),
      /widget entry not found/
    )
    assert.equal(fs.existsSync(path.join(tmp, 'widgets', 'incoming-broken')), false)
  })

  it('deletes an installed widget folder', async () => {
    await registry.deleteWidget('imported-widget')
    assert.equal(fs.existsSync(path.join(tmp, 'widgets', 'imported-widget')), false)
    assert.equal(registry.listWidgets().some(w => w.id === 'imported-widget'), false)
  })

  it('never resolves a path outside the widgets root', () => {
    assert.throws(
      () => userWidget.resolveUserWidgetEntry('../escape'),
      /Invalid widget ID/
    )
  })
})
