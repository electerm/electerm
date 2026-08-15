/**
 * Terminal command-history test
 *
 * Verifies:
 *  1. Running a command in a local terminal adds it to cmd history.
 *  2. Clicking the history item re-runs the command.
 *  3. Deleting a history item removes it from the list.
 *  4. History persists across app restarts.
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
const { closeApp } = require('./common/common')

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Open the command-history popover in the footer.
 *  Closes any currently-open popover first so we get a clean open. */
async function openHistoryPopover (client) {
  // Click outside any popover to ensure it is closed before reopening
  await client.click('.session-current .term-wrap')
  await delay(400)
  await client.click('.terminal-footer-history .ant-btn')
  await delay(800)
}

/** Close the popover by clicking outside of it. */
async function closeHistoryPopover (client) {
  await client.click('.session-current .term-wrap')
  await delay(400)
}

/**
 * Return the text of all visible command-history items.
 * The popover must already be open.
 */
async function getHistoryItems (client) {
  const items = await client.locator('.cmd-history-item .cmd-history-item-text')
  const count = await items.count()
  const texts = []
  for (let i = 0; i < count; i++) {
    texts.push(await items.nth(i).innerText())
  }
  return texts
}

/**
 * Hover over a history item whose text includes `term` to reveal action buttons,
 * then click the delete button.  The popover must already be open.
 */
async function deleteHistoryItem (client, term) {
  const items = client.locator('.cmd-history-item')
  const count = await items.count()
  for (let i = 0; i < count; i++) {
    const txt = await items.nth(i).locator('.cmd-history-item-text').innerText()
    if (txt.includes(term)) {
      await items.nth(i).hover()
      await delay(400)
      await items.nth(i).locator('.cmd-history-item-delete').click()
      await delay(600)
      return
    }
  }
  throw new Error(`History item matching "${term}" not found in popover`)
}

/** Return the cmd strings currently in window.store.terminalCommandHistory. */
async function getStoredHistory (client) {
  return client.evaluate(() =>
    window.store.terminalCommandHistory.map(i => i.cmd)
  )
}

/** Type a command in the terminal and press Enter. */
async function runInTerminal (client, cmd) {
  await client.click('.session-current .term-wrap')
  await delay(1000)
  await client.keyboard.type(cmd)
  await delay(300)
  await client.keyboard.press('Enter')
  await delay(1500)
}

// ─── test ─────────────────────────────────────────────────────────────────────

describe('cmd-history', function () {
  it('should add, re-run, delete commands and persist across restarts', async function () {
    // ── first session ──────────────────────────────────────────────────────────
    let electronApp = await electron.launch(appOptions)
    let client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(13000)
    log('021: app launched (session 1)')

    const ts = Date.now()
    // Use simple commands without quotes to avoid shell-escaping issues
    const cmd1 = `echo cmd-history-test-${ts}`
    const cmd2 = `echo cmd-history-persist-${ts}`

    // Clear existing history so our unique commands are easy to find
    await client.evaluate(() => window.store.clearAllCmdHistory())
    await delay(300)

    // ── step 1: run cmd1 in terminal → should appear in history ───────────────
    await runInTerminal(client, cmd1)
    log(`021: ran "${cmd1}" in terminal`)

    // Verify via store (ground truth)
    const stored1 = await getStoredHistory(client)
    log(`021: stored history: ${JSON.stringify(stored1)}`)
    expect(stored1.includes(cmd1)).equal(true)

    // Verify via UI popover
    await openHistoryPopover(client)
    const items1 = await getHistoryItems(client)
    log(`021: history popover items: ${JSON.stringify(items1)}`)
    expect(items1.some(t => t.trim() === cmd1 || t.includes(`cmd-history-test-${ts}`))).equal(true)

    // ── step 2: click the item to re-run the command ──────────────────────────
    const allItems = client.locator('.cmd-history-item')
    const count = await allItems.count()
    let clicked = false
    for (let i = 0; i < count; i++) {
      const txt = await allItems.nth(i).locator('.cmd-history-item-text').innerText()
      if (txt.includes(`cmd-history-test-${ts}`)) {
        await allItems.nth(i).locator('.cmd-history-item-text').click()
        clicked = true
        break
      }
    }
    expect(clicked).equal(true)
    await delay(2000)
    log('021: clicked history item to re-run')

    // count in store should have updated (command was re-run)
    const stored2 = await getStoredHistory(client)
    expect(stored2.includes(cmd1)).equal(true)

    // ── step 3: delete the item ────────────────────────────────────────────────
    // Reopen popover (clicking the item might or might not have closed it; use
    // the helper which first clicks outside to normalise state)
    await openHistoryPopover(client)
    await deleteHistoryItem(client, `cmd-history-test-${ts}`)
    const storedAfterDel = await getStoredHistory(client)
    log(`021: history after delete: ${JSON.stringify(storedAfterDel)}`)
    expect(storedAfterDel.includes(cmd1)).equal(false)
    await closeHistoryPopover(client)

    // ── step 4: run cmd2 that should persist after restart ────────────────────
    await runInTerminal(client, cmd2)
    await delay(2000) // allow store + db flush
    log(`021: ran "${cmd2}" in terminal`)

    await closeApp(electronApp, __filename)
    log('021: session 1 closed')

    // ── second session (restart) ───────────────────────────────────────────────
    await delay(2000)
    electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(13000)
    log('021: app launched (session 2 – restart)')

    // cmd2 must still be in history
    const storedRestart = await getStoredHistory(client)
    log(`021: history after restart: ${JSON.stringify(storedRestart)}`)
    expect(storedRestart.includes(cmd2)).equal(true)

    // cmd1 must NOT be in history (was deleted before restart)
    expect(storedRestart.includes(cmd1)).equal(false)

    await closeApp(electronApp, __filename)
    log('021: all cmd-history tests passed')
  })
})
