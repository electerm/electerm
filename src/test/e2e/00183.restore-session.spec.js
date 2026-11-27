const { _electron: electron, test, expect } = require('@playwright/test')
const { resolve } = require('node:path')
const appOptions = require('./common/app-options')

test('restore session saves workspace changes and takes precedence at startup', async () => {
  test.setTimeout(90000)
  const dataDir = test.info().outputPath('profile')
  const options = {
    ...appOptions,
    args: [resolve(__dirname, 'common/titlebar-app.js'), ...appOptions.args.slice(1)],
    env: { ...appOptions.env, DATA_PATH: dataDir }
  }
  delete options.env.ELECTRON_RUN_AS_NODE
  let app
  async function launch () {
    app = await electron.launch(options)
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded)
    return page
  }

  function savedConfig (page) {
    return page.evaluate(() => window.pre.runGlobalAsync('dbAction', 'data', 'findOne', { _id: 'userConfig' }))
  }

  try {
    let page = await launch()
    await page.evaluate(() => {
      const { store } = window
      store.addItems(['saved', 'startup'].map(id => ({ id, title: id, type: 'local' })), 'bookmarks')
      store.setConfig({ restoreSessionOnStart: true, initDefaultTabOnStart: true, onStartSessions: ['startup'] })
      store.removeTabs(() => true)
      store.setLayout('c2')
      store.onSelectBookmark('saved', 1)
      store.updateTab(store.activeTabId, { sshSftpSplitView: true })
    })
    await expect.poll(() => savedConfig(page)).toMatchObject({ restoreSessionOnStart: true })
    await app.close()
    page = await launch()
    expect(await page.evaluate(() => ({
      layout: window.store.layout,
      tabs: window.store.tabs.map(t => [t.srcId, t.batch, t.sshSftpSplitView])
    }))).toEqual({ layout: 'c2', tabs: [['saved', 1, true]] })

    await page.evaluate(() => {
      window.store.removeTabs(() => true)
      window.store.setConfig({ onStartSessions: [] })
    })
    await expect.poll(() => savedConfig(page)).toMatchObject({ onStartSessions: [] })
    await app.close()
    page = await launch()
    expect(await page.evaluate(() => window.store.tabs.length)).toBe(0)
    await page.evaluate(() => window.store.setConfig({ restoreSessionOnStart: false }))
    expect(await page.evaluate(() => window.localStorage.getItem('startup-workspace'))).toBeNull()
    await expect.poll(() => savedConfig(page)).toMatchObject({ restoreSessionOnStart: false })
    await app.close()
    page = await launch()
    expect(await page.evaluate(() => window.store.tabs.length)).toBe(2)
  } finally {
    await app?.close()
  }
})
