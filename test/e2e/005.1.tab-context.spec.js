/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('ssh', function () {
  it('should open window and basic ssh ls command works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    await client.rightClick('.tabs .tab', 10, 10)
    await client.click('.ant-dropdown .anticon-copy')
    await delay(2500)
    const tabsCount = await client.evaluate(() => {
      return window.store.tabs.length
    })
    expect(tabsCount).equal(2)
    // Test clone to next layout
    const initialLayout = await client.evaluate(() => {
      return window.store.layout
    })
    await client.rightClick('.tabs .tab', 10, 10)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Clone to Next Layout")') // Click clone to next layout option
    await delay(2000)

    // Verify new layout and tab count
    const newLayout = await client.evaluate(() => {
      return window.store.layout
    })
    expect(newLayout === initialLayout).equal(false) // Layout should have changed

    const newTabsCount = await client.evaluate(() => {
      return window.store.tabs.length
    })
    expect(newTabsCount).equal(3) // Original + duplicated + cloned tab

    // Restore original layout
    await client.evaluate((originalLayout) => {
      window.store.setLayout(originalLayout)
    }, initialLayout)
    await delay(1000)

    // Verify layout was restored
    const finalLayout = await client.evaluate(() => {
      return window.store.layout
    })
    expect(finalLayout).equal(initialLayout)

    await client.rightClick('.tabs .tab', 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New tab")')
    await delay(2000)

    // Verify a new tab was created and is the last tab and active
    const tabsInfo = await client.evaluate(() => {
      const tabs = window.store.tabs
      return {
        totalCount: tabs.length,
        lastTabId: tabs[tabs.length - 1].id,
        activeTabId: window.store.activeTabId
      }
    })
    expect(tabsInfo.totalCount).equal(4)
    expect(tabsInfo.lastTabId).equal(tabsInfo.activeTabId)

    await client.rightClick('.tabs .tab', 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Close other tabs")')
    await delay(2000)

    // Verify only one tab remains and it's the active tab
    const tabsInfoAfterClose = await client.evaluate(() => {
      const tabs = window.store.tabs
      return {
        totalCount: tabs.length,
        remainingTabId: tabs[0].id,
        activeTabId: window.store.activeTabId
      }
    })

    expect(tabsInfoAfterClose.totalCount).equal(1)
    expect(tabsInfoAfterClose.remainingTabId).equal(tabsInfoAfterClose.activeTabId)

    // close tab context menu
    // Create two more tabs for testing
    await client.click('.tabs-add-btn')
    await delay(1000)
    await client.click('.tabs-add-btn')
    await delay(1000)

    // Test closing a non-active tab
    const tabsBeforeClose = await client.evaluate(() => {
      return {
        count: window.store.tabs.length,
        activeTabId: window.store.activeTabId,
        secondTabId: window.store.tabs[1].id
      }
    })

    await client.rightClick(`.tabs .tab[data-id="${tabsBeforeClose.secondTabId}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Close")')
    await delay(1000)

    const tabsAfterNonActiveClose = await client.evaluate(() => {
      return {
        count: window.store.tabs.length,
        activeTabId: window.store.activeTabId
      }
    })

    expect(tabsAfterNonActiveClose.count).equal(tabsBeforeClose.count - 1)
    expect(tabsAfterNonActiveClose.activeTabId).equal(tabsBeforeClose.activeTabId)

    // Test closing the active tab
    const activeTabInfo = await client.evaluate(() => {
      return {
        activeTabId: window.store.activeTabId,
        nextTabId: window.store.tabs[0].id
      }
    })

    await client.rightClick(`.tabs .tab[data-id="${activeTabInfo.activeTabId}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Close")')
    await delay(1000)

    const tabsAfterActiveClose = await client.evaluate(() => {
      return {
        count: window.store.tabs.length,
        activeTabId: window.store.activeTabId
      }
    })

    expect(tabsAfterActiveClose.count).equal(tabsAfterNonActiveClose.count - 1)
    expect(tabsAfterActiveClose.activeTabId).equal(activeTabInfo.nextTabId)

    // Test rename tab from context menu
    // Create a new tab for rename testing
    await client.click('.tabs-add-btn')
    await delay(1000)

    const tabInfo = await client.evaluate(() => {
      return {
        tabId: window.store.tabs[0].id,
        originalTitle: window.store.tabs[0].title
      }
    })

    // Test rename using Enter key
    await client.rightClick(`.tabs .tab[data-id="${tabInfo.tabId}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
    await delay(500)

    const newTitle1 = 'renamed-tab-1'
    await client.setValue('.tab input', newTitle1)
    await client.keyboard.press('Enter')
    await delay(500)

    // Verify the title was changed and edit mode is off
    let renamedTabInfo = await client.evaluate(() => {
      const tab = window.store.tabs[0]
      return {
        title: tab.title,
        isEditing: !!tab.isEditting
      }
    })
    expect(renamedTabInfo.title).equal(newTitle1)
    expect(renamedTabInfo.isEditing).equal(false)

    // Test rename by clicking outside
    await client.rightClick(`.tabs .tab[data-id="${tabInfo.tabId}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
    await delay(500)

    const newTitle2 = 'renamed-tab-2'
    await client.setValue('.tab input', newTitle2)
    await client.click('.tabs-add-btn') // Click outside to blur
    await delay(1200)

    // Verify the title was changed and edit mode is off
    renamedTabInfo = await client.evaluate(() => {
      const tab = window.store.tabs[0]
      return {
        title: tab.title,
        isEditing: !!tab.isEditting
      }
    })
    expect(renamedTabInfo.title).equal(newTitle2)
    expect(renamedTabInfo.isEditing).equal(false)

    await electronApp.close().catch(console.log)
  })
})
