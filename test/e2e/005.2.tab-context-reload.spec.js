/*
 * Test tab reload context menu
 * Need TEST_HOST, TEST_PASS, TEST_USER env set
 */

const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('tab reload', function () {
  it('should replace active tab and update activeTabId', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)

    // Create 2 tabs
    await client.click('.tabs-add-btn')
    await delay(2000)

    // Get initial state
    const initialTabs = await client.evaluate(() => ({
      tabs: window.store.tabs,
      activeId: window.store.activeTabId
    }))

    // Reload active tab
    await client.rightClick(`.tabs .tab[data-id="${initialTabs.activeId}"]`, 10, 10)
    await client.click('.ant-dropdown-menu-item:has-text("Reload")')
    await delay(2000)

    // Verify replacement
    const afterReload = await client.evaluate(() => ({
      tabs: window.store.tabs,
      activeId: window.store.activeTabId
    }))

    expect(afterReload.tabs.length).equal(initialTabs.tabs.length)
    expect(initialTabs.tabs.some(t => t.id === afterReload.activeId)).equal(false)
    expect(afterReload.activeId !== initialTabs.activeId).equal(true)
    expect(afterReload.activeId === afterReload.tabs[1].id).equal(true)

    await electronApp.close()
  })

  it('should keep activeTabId when reloading inactive tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)

    // Create 2 tabs
    await client.click('.tabs-add-btn')
    await delay(2000)

    // Switch to first tab and get inactive tab ID
    await client.click('.tabs .tab:first-child')
    await delay(1000)
    const { tabs, activeId } = await client.evaluate(() => ({
      tabs: window.store.tabs,
      activeId: window.store.activeTabId
    }))
    const inactiveTab = tabs.find(t => t.id !== activeId)

    // Reload inactive tab
    await client.rightClick(`.tabs .tab[data-id="${inactiveTab.id}"]`, 10, 10)
    await client.click('.ant-dropdown-menu-item:has-text("Reload")')
    await delay(2000)

    // Verify state
    const afterReload = await client.evaluate(() => ({
      tabs: window.store.tabs,
      activeId: window.store.activeTabId
    }))

    expect(afterReload.tabs.length).equal(tabs.length)
    expect(afterReload.activeId).equal(activeId)
    expect(afterReload.tabs.some(t => t.id === inactiveTab.id)).equal(false)

    await electronApp.close()
  })
})
