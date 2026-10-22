/**
 * Config-mode user widgets: the widget ships only package.json configs + a
 * main-process module. electerm draws the form, calls the action, and renders
 * the returned result (details/table/row buttons/openTab) itself.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')

test.setTimeout(90000)

const WIDGETS = path.resolve(process.cwd(), 'src/test/fixtures/widgets')

test('config mode renders the form and the action result', async () => {
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-form-e2e-'))
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

    const imported = await page.evaluate(
      (dir) => window.pre.runGlobalAsync('importWidget', dir, false),
      path.join(WIDGETS, 'form-demo')
    )
    assert.deepEqual(imported, { id: 'form-demo', success: true })

    const widget = await page.evaluate(async () => {
      const list = await window.store.listWidgets()
      return list.find(w => w.id === 'form-demo')
    })
    assert.equal(widget.info.ui, '')
    assert.equal(widget.info.action, 'run')
    assert.equal(widget.info.configs.length, 6)

    await page.evaluate((w) => {
      window.store.openWidgetsModal()
      window.store.settingTab = 'widgets'
      window.store.setSettingItem(w)
    }, widget)
    await page.waitForSelector('.custom-widget-form')

    // 1. the form is generated from configs, one control per type
    assert.equal(await page.locator('label[for="host"]').textContent(), 'Host')
    assert.equal(await page.locator('#host').getAttribute('placeholder'), '10.0.0.1')
    assert.equal(await page.locator('#passphrase').getAttribute('type'), 'password')
    assert.equal(await page.locator('#port').inputValue(), '22')
    assert.equal(await page.locator('#secure').getAttribute('aria-checked'), 'true')
    // antd 6 renders the selected label in .ant-select-content (title included)
    assert.equal(
      await page.locator('.ant-select .ant-select-content').first().getAttribute('title'),
      'SSH'
    )

    // 1b. required fields block submit before any IPC call
    await page.click('button[type="submit"]')
    await page.waitForSelector('.ant-form-item-explain-error')
    assert.equal(await page.locator('.cwf-result').count(), 0)

    // 1c. the file field opens the native picker and writes the chosen path
    //     (the dialog itself cannot be driven from a spec: answer it in main)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('show-open-dialog-sync')
      ipcMain.handle('show-open-dialog-sync', async () => ['/tmp/demo.key'])
    })
    const fileItem = page.locator('.ant-form-item', { hasText: 'GPG key file' })
    await fileItem.locator('button').click()
    await page.waitForFunction(() => document.querySelector('#keyPath').value === '/tmp/demo.key')

    // 2. submit -> main-process action -> rendered result
    await page.fill('#host', 'demo.local')
    await page.fill('#passphrase', 'pw-123')
    await page.click('button[type="submit"]')
    await page.waitForSelector('.cwf-result')
    await page.waitForFunction(() => document.body.textContent.includes('Searched demo.local'))
    assert.equal(await page.locator('.cwf-table .ant-table-row').count(), 1)

    // secret details are masked until revealed, and the passphrase is not in
    // the persisted form copy in local storage
    const passRow = page.locator('.cwf-detail', { hasText: 'Passphrase' })
    assert.match(await passRow.locator('.cwf-secret-text').textContent(), /^•+$/)
    const stored = await page.evaluate(() => {
      const key = Object.keys(window.localStorage).find(k => k.includes('widget-config-form-demo'))
      return key ? window.localStorage.getItem(key) : ''
    })
    assert.ok(stored, 'form values are persisted')
    assert.equal(stored.includes('pw-123'), false, 'passphrase is never persisted')
    await passRow.locator('button').first().click()
    assert.equal(await passRow.locator('.cwf-secret-text').textContent(), 'pw-123')

    // 3. hit the backend like a real connection: the tab carries the widget
    //    origin so it stays out of connection history
    await page.locator('.cwf-table .ant-table-row button', { hasText: 'Open' }).click()
    await page.waitForFunction(() => window.store.tabs.some(t => t.from === 'widget:form-demo'))
    const tab = await page.evaluate(() => {
      const t = window.store.tabs.find(x => x.from === 'widget:form-demo')
      return { host: t.host, port: t.port, username: t.username, password: t.password }
    })
    assert.deepEqual(tab, { host: 'demo.local', port: 22, username: 'root', password: 'pw-123' })

    // 4. a row action stacks its result, so there is a way back
    await page.locator('.cwf-result-head button').first().click()
    await page.waitForSelector('.cwf-table')

    // 5. extra buttons call the same main-process module with the form values
    await page.locator('.cwf-buttons button', { hasText: 'Echo mode' }).click()
    await page.waitForFunction(() => document.body.textContent.includes('mode ssh'))
    assert.equal(await page.locator('.cwf-table').count(), 0)

    await page.screenshot({ path: '/tmp/widget-config-mode.png' })

    // 6. removing the widget removes its folder
    await page.evaluate(() => window.pre.runGlobalAsync('deleteWidget', 'form-demo'))
    assert.equal(fs.existsSync(path.join(profileRoot, 'data', 'widgets', 'form-demo')), false)

    // 7. the same field renderer still drives built-in widgets, whose configs
    //    use the key as label and may pass plain strings as choices
    const builtin = await page.evaluate(async () =>
      (await window.store.listWidgets()).find(w => w.id === 'local-file-server'))
    await page.evaluate((w) => window.store.setSettingItem(w), builtin)
    await page.waitForSelector('.widget-form')
    assert.equal(await page.locator('.custom-widget-form').count(), 0)
    assert.equal(await page.locator('label[for="dotfiles"]').count(), 1)
    assert.equal(
      await page.locator('.ant-select:has(#dotfiles) .ant-select-content').getAttribute('title'),
      'allow'
    )
  } finally {
    await app.close()
  }
})
