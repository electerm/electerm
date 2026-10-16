const { _electron: electron, test, expect } = require('@playwright/test')
const appOptions = require('./common/app-options')

test.setTimeout(60000)

test('tab bar keeps up with a tab title that gets longer after render', async () => {
  const app = await electron.launch(appOptions)
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setBounds({ x: 100, y: 100, width: 1200, height: 800 })
    })
    await page.evaluate(() => {
      window.store.addTab()
      window.store.addTab()
    })
    await expect(page.locator('.v1 .tabs .tab')).toHaveCount(3)

    // Rows of the 36px tab bar that hold a tab or the add button
    const rows = () => page.evaluate(() => {
      const tops = Array.from(
        document.querySelectorAll('.v1 .tabs-wrapper .tab, .v1 .tabs-wrapper .tabs-add-btn')
      ).map(el => Math.floor(el.offsetTop / 36))
      return new Set(tops).size
    })
    const setTitles = title => page.evaluate(title => {
      const { store } = window
      store.tabs.forEach(t => store.updateTab(t.id, { title }))
    }, title)

    // Wide enough tabs that still fit, which used to wrap onto a hidden row
    await setTitles('a long tab title '.repeat(8))
    await expect.poll(rows, {
      message: 'Tabs and the add button stay on one row after a title grows'
    }).toBe(1)
    await expect(page.locator('.v1 .tabs .tab-scroll-icon')).toHaveCount(0)

    // More tabs than fit, so the scroll buttons must show
    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) {
        window.store.addTab()
      }
    })
    await expect(page.locator('.v1 .tabs .tab')).toHaveCount(7)
    await setTitles('short')
    await setTitles('a long tab title '.repeat(8))
    await expect(page.locator('.v1 .tabs .tab-scroll-icon')).toHaveCount(2)
    expect(await rows()).toBe(1)
  } finally {
    await app.close()
  }
})
