const { mkdtempSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('./common/expect')
const baseOptions = require('./common/app-options')
const e = require('./common/lang')
const extendClient = require('./common/client-extend')

// this spec creates a theme and switches the active one, so it must not run
// against the developer's real config
const launchEnv = { ...baseOptions.env }
// an IDE terminal exports this and Electron then starts as plain node
delete launchEnv.ELECTRON_RUN_AS_NODE
const appOptions = {
  ...baseOptions,
  env: {
    ...launchEnv,
    DATA_PATH: mkdtempSync(join(tmpdir(), 'electerm-themes-'))
  }
}

describe('terminal themes', function () {
  it('all buttons open proper terminal themes tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    log('button:edit')
    await client.click('.btns .anticon-picture')
    await delay(500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    await delay(500)
    const text = await client.getText(sel)
    expect(text).equal(e('uiThemes'))

    const v = await client.getValue('.setting-wrap #terminal-theme-form_themeName')
    const tx = await client.getText('.setting-wrap .item-list-unit.active')
    const txd = await client.getText('.setting-wrap .item-list-unit.current')
    expect(v).equal(e('newTheme'))
    expect(tx).equal(e('newTheme'))
    expect(txd).equal(e('default'))

    // create theme
    log('create theme')
    const themePrev = await client.evaluate(() => {
      return window.store.terminalThemes.length
    })
    const themeIterm = await client.evaluate(() => {
      return window.store.itermThemes.length
    })
    await client.click('.setting-wrap .ant-btn-primary:visible')

    const themeNow = await client.evaluate(() => {
      return window.store.terminalThemes.length
    })
    await delay(1000)
    expect(themeNow).equal(themePrev + 1)
    expect(themeIterm > 10).equal(true)

    // a built-in theme cannot be edited, but it must still be applicable from
    // the form: its fields are disabled and "apply" replaces "save and apply"
    log('apply default theme from form')
    await client.click(
      `.setting-wrap .item-list-unit .elli:text-is("${e('default')}")`
    )
    await delay(500)
    const nameDisabled = await client
      .locator('.setting-wrap #terminal-theme-form_themeName')
      .isDisabled()
    expect(nameDisabled).equal(true)
    const applyBtn = client
      .locator('.setting-wrap .ant-btn-primary:visible')
      .nth(0)
    expect(await applyBtn.innerText()).equal(e('apply'))
    await applyBtn.click()
    await delay(500)
    const appliedTheme = await client.evaluate(() => {
      return window.store.config.theme
    })
    expect(appliedTheme).equal('default')

    // an editable theme gets the same apply button; there the primary action
    // is still "save and apply" further down
    log('apply user theme from form')
    const userThemeId = await client.evaluate(() => {
      const all = window.store.terminalThemes
      return all[all.length - 1].id
    })
    // the "+ new theme" placeholder carries the same label but has no id (so
    // nothing to apply), pick the row that is an actual theme
    await client.evaluate(name => {
      const rows = [...document.querySelectorAll('.setting-wrap .item-list-unit')]
      const row = rows.find(d => (
        !d.querySelector('.anticon-plus') && d.innerText.trim() === name
      ))
      row.click()
    }, e('newTheme'))
    await delay(500)
    const userApply = client
      .locator('.setting-wrap #terminal-theme-form button')
      .filter({ hasText: new RegExp(`^${e('apply')}$`) })
      .nth(0)
    await userApply.waitFor({ state: 'visible', timeout: 5000 })
    await userApply.click()
    await delay(500)
    const userApplied = await client.evaluate(() => {
      return window.store.config.theme
    })
    expect(userApplied).equal(userThemeId)
    await electronApp.close().catch(console.log)
  })
})
