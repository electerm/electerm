/**
 * Unit tests for user widget management (create / list / update / delete / test-run)
 */

const {
  test: it, expect
} = require('@playwright/test')
const { describe } = it
const os = require('os')
const path = require('path')
const fs = require('fs/promises')

it.setTimeout(30000)

// ── Stub app-props so the manager works outside Electron ─────────────────────
const tmpBase = path.join(os.tmpdir(), 'electerm-widget-test-' + Date.now())

// Intercept require('../common/app-props') inside user-widget-manager
const Module = require('module')
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (
    request === '../common/app-props' ||
    (parent && parent.filename && parent.filename.includes('user-widget-manager') && request.includes('app-props'))
  ) {
    return { appPath: tmpBase }
  }
  return originalLoad.apply(this, arguments)
}

const {
  listUserWidgets,
  createUserWidget,
  updateUserWidget,
  deleteUserWidget,
  testRunUserWidget,
  getDefaultWidgetTemplate
} = require('../../src/app/widgets/user-widget-manager')

// ── helpers ───────────────────────────────────────────────────────────────────

describe('user-widget-manager', function () {
  it.beforeAll(async () => {
    await fs.mkdir(path.join(tmpBase, 'electerm', 'widgets'), { recursive: true })
  })

  it.afterAll(async () => {
    try {
      await fs.rm(tmpBase, { recursive: true, force: true })
    } catch (_) {}
  })

  // ── getDefaultWidgetTemplate ─────────────────────────────────────────────

  it('getDefaultWidgetTemplate should return non-empty string', async () => {
    const tpl = getDefaultWidgetTemplate()
    expect(typeof tpl).toBe('string')
    expect(tpl.length).toBeGreaterThan(0)
    expect(tpl).toContain('widgetInfo')
    expect(tpl).toContain('widgetRun')
  })

  // ── createUserWidget ─────────────────────────────────────────────────────

  it('createUserWidget should create a widget with default template', async () => {
    const widget = createUserWidget()
    expect(typeof widget.id).toBe('string')
    expect(widget.id.length).toBeGreaterThan(0)
    expect(widget.userCreated).toBe(true)
    expect(typeof widget.info).toBe('object')
    expect(typeof widget.info.name).toBe('string')

    // File should exist on disk
    const widgetDir = path.join(tmpBase, 'electerm', 'widgets')
    const files = await fs.readdir(widgetDir)
    expect(files).toContain(`widget-${widget.id}.js`)
  })

  it('createUserWidget should reject invalid code', async () => {
    let threw = false
    try {
      createUserWidget('this is not valid widget code !!!{}')
    } catch (err) {
      threw = true
    }
    expect(threw).toBe(true)
  })

  // ── listUserWidgets ──────────────────────────────────────────────────────

  it('listUserWidgets should return previously created widgets', async () => {
    // Ensure at least one widget exists from previous test
    const list = listUserWidgets()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThanOrEqual(1)
    for (const w of list) {
      expect(w.userCreated).toBe(true)
      expect(typeof w.id).toBe('string')
      expect(typeof w.code).toBe('string')
      expect(typeof w.info).toBe('object')
    }
  })

  // ── updateUserWidget ─────────────────────────────────────────────────────

  it('updateUserWidget should update widget code', async () => {
    const original = createUserWidget()
    const updatedCode = getDefaultWidgetTemplate().replace(
      'My Custom Widget',
      'Updated Widget'
    )
    const updated = updateUserWidget(original.id, updatedCode)
    expect(updated.id).toBe(original.id)
    expect(updated.info.name).toBe('Updated Widget')

    // Verify file contents changed
    const filePath = path.join(tmpBase, 'electerm', 'widgets', `widget-${original.id}.js`)
    const onDisk = await fs.readFile(filePath, 'utf8')
    expect(onDisk).toContain('Updated Widget')
  })

  it('updateUserWidget should reject non-existent widget id', async () => {
    let threw = false
    try {
      updateUserWidget('does-not-exist-id', getDefaultWidgetTemplate())
    } catch (_) {
      threw = true
    }
    expect(threw).toBe(true)
  })

  // ── deleteUserWidget ─────────────────────────────────────────────────────

  it('deleteUserWidget should remove the file', async () => {
    const widget = createUserWidget()
    const filePath = path.join(tmpBase, 'electerm', 'widgets', `widget-${widget.id}.js`)

    // File should exist before delete
    await expect(fs.access(filePath)).resolves.toBeUndefined()

    deleteUserWidget(widget.id)

    // File should be gone after delete
    let threw = false
    try {
      await fs.access(filePath)
    } catch (_) {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('deleteUserWidget should throw for non-existent widget', async () => {
    let threw = false
    try {
      deleteUserWidget('no-such-widget')
    } catch (_) {
      threw = true
    }
    expect(threw).toBe(true)
  })

  // ── testRunUserWidget ────────────────────────────────────────────────────

  it('testRunUserWidget should run a valid once-type widget and return result', async () => {
    const code = `
const widgetInfo = {
  name: 'Test Widget',
  description: 'Test',
  version: '1.0.0',
  author: '',
  type: 'once',
  configs: [{ name: 'greeting', type: 'string', default: 'hi' }]
}

function widgetRun (config) {
  return { success: true, msg: config.greeting + ' world' }
}

module.exports = { widgetInfo, widgetRun }
`
    const result = await testRunUserWidget(code, { greeting: 'hello' })
    expect(result.success).toBe(true)
    expect(result.msg).toBe('hello world')
  })

  it('testRunUserWidget should propagate syntax errors', async () => {
    let threw = false
    try {
      await testRunUserWidget('const x = {{{', {})
    } catch (_) {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('testRunUserWidget should run an instance-type widget (start + stop)', async () => {
    const code = `
const uid = () => Math.random().toString(36).slice(2)

const widgetInfo = {
  name: 'Instance Test',
  description: '',
  version: '1.0.0',
  author: '',
  type: 'instance',
  configs: []
}

function widgetRun (config) {
  return {
    instanceId: uid(),
    async start () {
      return { msg: 'started', serverInfo: { port: 9999 } }
    },
    async stop () {}
  }
}

module.exports = { widgetInfo, widgetRun }
`
    const result = await testRunUserWidget(code, {})
    expect(result.msg).toBe('started')
    expect(result.testRun).toBe(true)
  })
})
