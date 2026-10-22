/**
 * Custom (user) widgets: import a folder into DATA_PATH/widgets, list it next to
 * the built-ins, and render the widget's own UI in electerm-widget://<id>/ with
 * the window.electerm bridge wired to the host.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')

test.setTimeout(90000)

const WIDGETS = path.resolve(process.cwd(), 'src/test/fixtures/widgets')

test('custom widget UI talks to the host', async () => {
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-e2e-'))
  const app = await electron.launch({
    ...appOptions,
    args: [...appOptions.args, `--user-data-dir=${profileRoot}`],
    env: {
      ...appOptions.env,
      DATA_PATH: path.join(profileRoot, 'data'),
      XDG_CONFIG_HOME: path.join(profileRoot, 'config')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded === true, null, { timeout: 30000 })

    // 1. install: whole folder copied into DATA_PATH/widgets/<id>
    const imported = await page.evaluate(
      (dir) => window.pre.runGlobalAsync('importWidget', dir, false),
      path.join(WIDGETS, 'hello-ui')
    )
    assert.deepEqual(imported, { id: 'hello-ui', success: true })

    const installedDir = path.join(profileRoot, 'data', 'widgets', 'hello-ui')
    assert.ok(fs.existsSync(path.join(installedDir, 'ui', 'app.js')), 'nested file copied')
    assert.ok(fs.existsSync(path.join(installedDir, 'ui', 'style.css')), 'stylesheet copied')

    // 2. listed next to the built-ins, metadata read from package.json
    const widgets = await page.evaluate(() => window.store.listWidgets())
    const hello = widgets.find(w => w.id === 'hello-ui')
    assert.ok(hello, 'hello-ui is listed')
    assert.equal(hello.builtin, false)
    assert.equal(hello.state, 'ok')
    assert.equal(hello.info.name, 'Hello UI')
    assert.equal(hello.info.ui, 'ui/index.html')
    assert.ok(widgets.some(w => w.id === 'ssh-server' && w.builtin === true))

    // 3. the list UI: import is its own labelled row above the search box (as a
    //    search addon it read as part of the search feature); delete only on
    //    user widgets, revealed on hover like every other list action
    await page.evaluate(() => window.store.openWidgetsModal())
    await page.waitForSelector('.item-type-widgets .item-list-unit')
    assert.equal(await page.locator('.item-type-widgets .anticon-import').count(), 1)
    const importRow = await page.evaluate(() => {
      const list = document.querySelector('.item-type-widgets')
      const row = list.querySelector('.widgets-import-row')
      const btn = row.querySelector('.anticon-import').closest('button')
      const b = btn.getBoundingClientRect()
      const r = row.getBoundingClientRect()
      const input = list.querySelector('input').getBoundingClientRect()
      return {
        text: btn.innerText.trim(),
        groupedWithSearch: !!btn.closest('.ant-input-search, .ant-space-compact'),
        aboveSearch: b.bottom <= input.top,
        // the help icon takes its ~17px out of the row, nothing else should
        fillsRow: Math.abs(b.width - (r.width - 17)) <= 4,
        rowWidth: Math.round(r.width),
        listWidth: Math.round(list.getBoundingClientRect().width),
        helpIcons: row.querySelectorAll('.anticon-question-circle').length
      }
    })
    assert.equal(importRow.text, 'Import', 'import carries a label, not just an icon')
    assert.equal(importRow.groupedWithSearch, false, 'not a search addon')
    assert.equal(importRow.aboveSearch, true, 'own row above the search box')
    assert.equal(importRow.fillsRow, true)
    assert.equal(importRow.rowWidth, importRow.listWidth, 'the row itself is list-wide')
    assert.equal(importRow.helpIcons, 1, 'wiki help icon sits next to it')
    // the icon must link at the wiki page, not just exist
    const helpBox = await page.locator('.widgets-import-row .anticon-question-circle').boundingBox()
    let helpHref = ''
    for (let i = 0; i < 10 && !helpHref; i++) {
      await page.mouse.move(helpBox.x + helpBox.width / 2, helpBox.y + helpBox.height / 2)
      await page.waitForTimeout(200)
      helpHref = await page.evaluate(() => {
        const a = document.querySelector('.ant-tooltip:not(.ant-tooltip-hidden) a')
        return a ? a.getAttribute('href') : ''
      })
    }
    assert.equal(helpHref, 'https://github.com/electerm/electerm/wiki/User-widget-guide')
    const row = page.locator('.item-type-widgets .item-list-unit', { hasText: 'Hello UI' })
    assert.equal(await row.count(), 1)
    const builtinRow = page.locator('.item-type-widgets .item-list-unit', { hasText: 'SSH Server' })
    assert.equal(await builtinRow.locator('.list-item-remove').count(), 0)
    // A real pointer move, retried: the list fills in asynchronously, so a
    // single move can land on the row before it settles. (playwright's hover()
    // does not set :hover in this modal at all — matches(':hover') stays false.)
    const icon = row.locator('.list-item-remove')
    let visible = false
    for (let i = 0; i < 10 && !visible; i++) {
      const box = await row.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(150)
      visible = await icon.isVisible()
    }
    assert.equal(visible, true, 'delete control appears on hover')
    const iconBox = await icon.boundingBox()
    assert.ok(iconBox.width > 8 && iconBox.height > 8, 'delete control has a hit area')

    // 4. the panel renders the widget's own document
    await page.evaluate((widget) => {
      window.store.settingTab = 'widgets'
      window.store.setSettingItem(widget)
    }, hello)

    const frame = await (async () => {
      for (let i = 0; i < 100; i++) {
        const f = page.frames().find(fr => fr.url().startsWith('electerm-widget://hello-ui/'))
        if (f) {
          return f
        }
        await page.waitForTimeout(100)
      }
      throw new Error('widget frame missing: ' + page.frames().map(f => f.url()).join(' | '))
    })()
    assert.match(frame.url(), /electerm-widget:\/\/hello-ui\/ui\/index\.html/)
    assert.equal(await page.locator('.cwp-frame').count(), 1)

    // 4. theme variables and init data arrive through the bridge
    await frame.waitForFunction(() => document.body.textContent.includes('bridge ready'))
    const init = await frame.evaluate(() => ({
      id: window.electerm.id,
      out: document.getElementById('out').textContent,
      background: window.getComputedStyle(document.body).backgroundColor,
      mainVar: window.getComputedStyle(document.documentElement).getPropertyValue('--main').trim()
    }))
    assert.equal(init.id, 'hello-ui')
    assert.match(init.out, /bridge ready: hello-ui \/ (dark|light)/)
    assert.ok(init.mainVar, 'theme variables are forwarded')
    assert.notEqual(init.background, 'rgba(0, 0, 0, 0)', 'widget inherits a real background')

    // 5. window.electerm.call reaches the main-process module
    await frame.click('#greet')
    await frame.waitForFunction(() => document.getElementById('out').textContent.includes('Hello'))
    assert.equal(await frame.textContent('#out'), 'Hello, world!')

    // arguments and errors survive the boundary
    await frame.fill('#name', 'electerm')
    await frame.click('#upper')
    await frame.waitForFunction(() => document.getElementById('out').textContent === 'ELECTERM')

    await frame.evaluate(async () => {
      try {
        await window.electerm.call('notExported')
        document.getElementById('out').textContent = 'NO ERROR'
      } catch (err) {
        document.getElementById('out').textContent = 'rejected: ' + err.message
      }
    })
    assert.match(await frame.textContent('#out'), /rejected: .*does not export the function notExported/)

    await page.screenshot({ path: '/tmp/widget-panel.png' })

    // 6. a passbolt-shaped widget: config, file dialog, main-process calls,
    //    and a tab opened with the secret the widget produced
    await page.evaluate((dir) => window.pre.runGlobalAsync('importWidget', dir, false), path.join(WIDGETS, 'vault-demo'))
    // the OS file dialog cannot be clicked from a spec: answer it in main
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('show-open-dialog-sync')
      ipcMain.handle('show-open-dialog-sync', async () => ['/tmp/demo.key'])
    })
    const vault = await page.evaluate(async () => {
      const list = await window.store.listWidgets()
      return list.find(w => w.id === 'vault-demo')
    })
    await page.evaluate((widget) => window.store.setSettingItem(widget), vault)

    const vaultFrame = await (async () => {
      for (let i = 0; i < 100; i++) {
        const f = page.frames().find(fr => fr.url().startsWith('electerm-widget://vault-demo/'))
        if (f) {
          return f
        }
        await page.waitForTimeout(100)
      }
      throw new Error('vault frame missing')
    })()
    await vaultFrame.waitForFunction(() => window.electerm)
    await vaultFrame.click('#pick')
    await vaultFrame.waitForFunction(() => document.getElementById('key').value === '/tmp/demo.key')
    await vaultFrame.fill('#server', 'https://passbolt.local')
    await vaultFrame.click('#connect')
    await vaultFrame.waitForFunction(() => document.getElementById('search').style.display === 'block')
    await vaultFrame.click('#go')
    await vaultFrame.waitForFunction(() => document.querySelectorAll('#results li').length === 2)

    // 6. config is the widget's own store, never the app config: a widget page
    //    must not be able to read or rewrite electerm settings
    const savedConfig = await vaultFrame.evaluate(() => window.electerm.getConfig())
    assert.equal(savedConfig.demoServerUrl, 'https://passbolt.local')
    assert.equal(await page.evaluate(() => window.store.config.demoServerUrl), undefined)
    assert.equal(
      await page.evaluate(() => Object.keys(window.store.config).includes('demoKeyPath')),
      false
    )

    await vaultFrame.click('#open-1')
    await vaultFrame.waitForFunction(() => document.getElementById('status').textContent.includes('opened ssh'))
    const tab = await page.evaluate(() => {
      const t = window.store.tabs.find(t => t.from === 'widget:vault-demo')
      return t ? { host: t.host, username: t.username, password: t.password } : null
    })
    assert.deepEqual(tab, { host: '10.0.0.12', username: 'root', password: 's3cret' })

    // 7. uninstall removes the folder and the entry
    await page.evaluate(() => window.pre.runGlobalAsync('deleteWidget', 'vault-demo'))
    assert.equal(fs.existsSync(path.join(profileRoot, 'data', 'widgets', 'vault-demo')), false)
    const after = await page.evaluate(() => window.store.listWidgets())
    assert.equal(after.some(w => w.id === 'vault-demo'), false)
  } finally {
    await app.close()
  }
})
