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

    // A pane can get narrower without a change to the window or its tabs.
    const pane = page.locator('.layout-item.v1')
    const originalWidth = await pane.evaluate(el => el.style.width)
    await pane.evaluate(el => { el.style.width = '500px' })
    const arrows = pane.locator('.tab-scroll-icon')
    await expect(arrows.first()).toBeVisible()
    await expect(arrows.last()).toBeVisible()
    const list = pane.locator('.session-list-trigger')
    await list.click()
    await expect(page.locator('.session-list-row')).toHaveCount(3)
    await list.click()
    await pane.evaluate((el, width) => { el.style.width = width }, originalWidth)
    await expect(arrows).toHaveCount(0)

    // More tabs than fit, so the scroll buttons must show
    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) {
        window.store.addTab()
      }
    })
    await expect(page.locator('.v1 .tabs .tab')).toHaveCount(7)
    await expect(arrows).toHaveCount(2)
    await list.click()
    await expect(page.locator('.session-list-row')).toHaveCount(7)
    await list.click()
    await setTitles('short')
    await setTitles('a long tab title '.repeat(8))
    await expect(page.locator('.v1 .tabs .tab-scroll-icon')).toHaveCount(2)
    expect(await rows()).toBe(1)
  } finally {
    await app.close()
  }
})

test('double-clicking the default local tab reveals the overflow controls', async () => {
  const app = await electron.launch(appOptions)
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setBounds({ x: 100, y: 100, width: 1200, height: 800 })
    })

    const bar = page.locator('.v1 .tabs')
    const tabs = bar.locator('.tab')
    const originalTitle = tabs.first().locator('div.tab-title')
    await expect(tabs).toHaveCount(1)
    await expect(bar.locator('.session-list-trigger')).toHaveCount(0)
    for (let count = 2; count <= 17; count++) {
      await originalTitle.dblclick()
      await expect(tabs).toHaveCount(count)
    }

    const arrows = bar.locator('.tab-scroll-icon')
    await expect(arrows.first()).toBeVisible()
    await expect(arrows.last()).toBeVisible()
    await arrows.last().click()
    const scrollLeft = () => bar.locator('.tabs-inner').evaluate(el => el.scrollLeft)
    await expect.poll(scrollLeft).toBeGreaterThan(0)
    await arrows.first().click()
    await expect.poll(scrollLeft).toBe(0)
    await bar.locator('.session-list-trigger').click()
    await expect(page.locator('.session-list-row')).toHaveCount(17)
  } finally {
    await app.close()
  }
})
