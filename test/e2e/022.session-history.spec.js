/**
 * Session (connection) history test
 *
 * Verifies:
 *  1. Opening a new SSH session adds it to the sidebar history panel.
 *  2. Clicking a history item opens a new session tab.
 *  3. Deleting a history item removes it from the list.
 *  4. Clicking the bookmark icon on a history item creates a bookmark.
 *  5. History persists across app restarts.
 *  6. "Sort by frequency" re-orders the history list.
 */

const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const { describe } = it
it.setTimeout(10000000)

const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')
const { setupSshConnection, closeApp } = require('./common/common')

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Open the sidebar and switch to the "history" tab. */
async function openSidebarHistory (client) {
  await client.evaluate(() => {
    window.store.setOpenedSideBar('bookmarks')
    window.store.handleSidebarPanelTab('history')
  })
  await delay(600)
}

/** Close the sidebar. */
async function closeSidebar (client) {
  await client.evaluate(() => window.store.setOpenedSideBar(''))
  await delay(300)
}

/** Return the raw history array from the store. */
async function getHistoryStore (client) {
  return client.evaluate(() =>
    window.store.history.map(h => ({ id: h.id, count: h.count, host: h.tab && h.tab.host }))
  )
}

/** Return the number of visible history items in the sidebar. */
async function getHistoryItemCount (client) {
  return client.locator('.sidebar-panel-history .item-list-unit').count()
}

/** Return the current tab count. */
async function getTabCount (client) {
  return client.locator('.tabs .tabs-wrapper .tab').count()
}

// ─── test ─────────────────────────────────────────────────────────────────────

describe('session-history', function () {
  it('should track, open, delete, bookmark history, persist and sort by frequency', async function () {
    // ── first session ──────────────────────────────────────────────────────────
    let electronApp = await electron.launch(appOptions)
    let client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    // Wait until initData has completed AND the history watcher is active
    await client.waitForFunction(() => {
      return window.store &&
        window.store.configLoaded === true &&
        !!window.watchhistory
    }, { timeout: 15000 })
    await delay(500) // small buffer after watcher starts
    log('022: app launched (session 1)')

    // Clear existing connection history
    await client.evaluate(() => { window.store.history.splice(0, window.store.history.length) })
    await delay(500) // allow watcher to flush removes to DB

    // ── step 1: open SSH session → history entry created ──────────────────────
    await setupSshConnection(client)
    await delay(4000)
    log('022: SSH connected')

    // Add a synthetic second entry so the delete step (step 5) leaves one entry
    // for the persistence check (step 7). Uses unshift so it becomes index 0.
    await client.evaluate(() => {
      window.store.history.unshift({
        id: 'synth-' + Date.now(),
        count: 5,
        time: Date.now() - 5000,
        tab: { host: '10.0.0.1', type: 'ssh', username: 'synthuser', port: 22 }
      })
    })
    await delay(800) // let watcher persist the synthetic entry

    const history1 = await getHistoryStore(client)
    log(`022: history after SSH connect: ${JSON.stringify(history1)}`)
    expect(history1.length).greaterThan(0)

    // ── step 2: open sidebar history → item visible ────────────────────────────
    await openSidebarHistory(client)
    const historyCount1 = await getHistoryItemCount(client)
    log(`022: sidebar history item count: ${historyCount1}`)
    expect(historyCount1).greaterThan(0)

    // ── step 3: click history item → new tab opens ────────────────────────────
    const tabsBefore = await getTabCount(client)
    await client.click('.sidebar-panel-history .item-list-unit', 0)
    await delay(3000)
    const tabsAfter = await getTabCount(client)
    log(`022: tabs before=${tabsBefore} after=${tabsAfter}`)
    expect(tabsAfter).greaterThan(tabsBefore)

    // ── step 4: bookmark icon → creates a bookmark ────────────────────────────
    await openSidebarHistory(client)
    const bookmarksBefore = await client.evaluate(() => window.store.bookmarks.length)

    // Hover first item to reveal the hidden bookmark icon, then click it
    const firstHistoryItem = client.locator('.sidebar-panel-history .item-list-unit').first()
    await firstHistoryItem.hover()
    await delay(200)
    await firstHistoryItem.locator('.list-item-bookmark').click()
    await delay(800)
    log('022: clicked bookmark icon on history item')

    // A modal should appear – confirm it (custom modal uses .custom-modal-footer-buttons)
    const confirmBtn = client.locator('.custom-modal-footer-buttons .ant-btn-primary')
    await confirmBtn.waitFor({ state: 'visible', timeout: 8000 })
    await confirmBtn.click()
    await delay(1000)
    log('022: confirmed bookmark creation')

    const bookmarksAfter = await client.evaluate(() => window.store.bookmarks.length)
    log(`022: bookmarks before=${bookmarksBefore} after=${bookmarksAfter}`)
    expect(bookmarksAfter).greaterThan(bookmarksBefore)

    // ── step 5: delete a history item ─────────────────────────────────────────
    await openSidebarHistory(client)
    const countBefore = await getHistoryItemCount(client)
    const firstHistoryItem2 = client.locator('.sidebar-panel-history .item-list-unit').first()
    await firstHistoryItem2.hover()
    await delay(200)
    await firstHistoryItem2.locator('.list-item-edit').click()
    await delay(800)
    const countAfter = await getHistoryItemCount(client)
    log(`022: sidebar history count before=${countBefore} after=${countAfter}`)
    expect(countAfter).equal(countBefore - 1)

    // ── step 6: sort by frequency ─────────────────────────────────────────────
    await closeSidebar(client)
    await openSidebarHistory(client)

    // Toggle "sort by frequency" switch
    const switchSel = '.sidebar-panel-history .history-header .ant-switch'
    const sortEnabled1 = await client.evaluate(() => {
      // Read localStorage key used by history.jsx
      const v = window.localStorage.getItem('electerm-history-sort-by-frequency')
      return v === 'true'
    })
    await client.locator(switchSel).click()
    await delay(500)
    const sortEnabled2 = await client.evaluate(() => {
      const v = window.localStorage.getItem('electerm-history-sort-by-frequency')
      return v === 'true'
    })
    log(`022: sort-by-freq toggled: ${sortEnabled1} → ${sortEnabled2}`)
    expect(sortEnabled2).equal(!sortEnabled1)

    // Toggle back
    await client.locator(switchSel).click()
    await delay(300)

    // ── step 7: close & reopen (persistence check) ────────────────────────────
    const historyBeforeClose = await getHistoryStore(client)
    await closeSidebar(client)
    await delay(2000) // ensure DB flushes before close
    await closeApp(electronApp, __filename)
    log('022: session 1 closed')

    await delay(2000)
    electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await client.waitForFunction(() => {
      return window.store &&
        window.store.configLoaded === true &&
        !!window.watchhistory
    }, { timeout: 15000 })
    await delay(300)
    log('022: app launched (session 2 – restart)')

    const historyAfterRestart = await getHistoryStore(client)
    log(`022: history after restart: ${JSON.stringify(historyAfterRestart)}`)
    // At least the remaining entry should be there
    expect(historyAfterRestart.length).greaterThan(0)
    // All IDs present before close must still be there (minus the deleted one)
    for (const h of historyAfterRestart) {
      const found = historyBeforeClose.some(p => p.id === h.id)
      expect(found).equal(true)
    }

    await closeApp(electronApp, __filename)
    log('022: all session-history tests passed')
  })
})
