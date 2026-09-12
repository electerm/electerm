/**
 * Terminal command-history test
 *
 * Verifies:
 *  1. Running a command in a local terminal adds it to cmd history.
 *  2. Clicking the history item re-runs the command.
 *  3. Deleting a history item (item action menu -> Delete) removes it from the list.
 *  4. History persists across app restarts.
 *  5. The item action menu can create a quick command from the item and run the
 *     item in several terminals at once.
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
const { getTerminalContent } = require('./common/basic-terminal-test')
const e = require('./common/lang')

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
 * Hover over the history item whose text includes `term` to reveal its action
 * buttons, then open the item action menu (⋯).
 * The popover must already be open.
 */
async function openItemMenu (client, term) {
  const items = client.locator('.cmd-history-item')
  const count = await items.count()
  for (let i = 0; i < count; i++) {
    const txt = await items.nth(i).locator('.cmd-history-item-text').innerText()
    if (txt.includes(term)) {
      await items.nth(i).hover()
      await delay(400)
      await items.nth(i).locator('.cmd-history-item-more').click()
      await delay(600)
      return
    }
  }
  throw new Error(`History item matching "${term}" not found in popover`)
}

/** Delete a history item through its action menu (⋯ -> Delete). */
async function deleteHistoryItem (client, term) {
  await openItemMenu(client, term)
  await client.click(`.ant-dropdown-menu-item:has-text("${e('del')}")`)
  await delay(600)
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

  it('should create a quick command and run the item in several terminals from the action menu', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(13000)
    log('021: app launched (action menu)')

    const ts = Date.now()
    const cmd = `echo cmd-history-action-${ts}`

    await client.evaluate(() => window.store.clearAllCmdHistory())
    await delay(300)

    // a second terminal so there is something to multi-select
    await client.click('.tabs .tabs-add-btn')
    await delay(500)
    await client.click('.add-menu-wrap .context-item:has-text("New tab")')
    await delay(2500)
    expect(await client.countElem('.tabs .tab')).equal(2)

    await runInTerminal(client, cmd)
    expect((await getStoredHistory(client)).includes(cmd)).equal(true)

    // ── action menu -> create quick command ───────────────────────────────────
    await openHistoryPopover(client)
    await openItemMenu(client, cmd)
    await client.click(`.ant-dropdown-menu-item:has-text("${e('addQuickCommands')}")`)
    await delay(2000)

    // the shared quick command form, prefilled with the history command
    const prefill = await client.evaluate(() => {
      const el = document.querySelector('.ant-modal .qm-input')
      return el ? el.value : ''
    })
    log(`021: quick command form command field: ${JSON.stringify(prefill)}`)
    expect(prefill.trim()).equal(cmd)

    // name comes prefilled too, so saving right away must work
    await client.click('.ant-modal button[type="submit"]')
    await delay(2000)
    const qmCmds = await client.evaluate(() =>
      window.store.quickCommands.map(qm => (qm.commands || []).map(c => c.command).join('\n'))
    )
    log(`021: quick commands: ${JSON.stringify(qmCmds)}`)
    expect(qmCmds.some(c => c.includes(cmd))).equal(true)
    // the form modal closes on save
    expect(await client.countElem('.ant-modal')).equal(0)

    // ── action menu -> run in multiple terminals ──────────────────────────────
    await openHistoryPopover(client)
    await openItemMenu(client, cmd)
    await client.click(`.ant-dropdown-menu-item:has-text("${e('runInAllTerminals')}")`)
    await delay(2000)
    expect(await client.countElem('.multi-tab-run-cmd')).equal(1)

    await client.click('.ant-modal span.pointer:has-text("All")')
    await delay(500)
    await client.click('.ant-modal-footer .ant-btn-primary')
    await delay(3000)

    // both terminals must have received the command
    const tabCount = await client.countElem('.tabs .tab')
    expect(tabCount).equal(2)
    for (let i = 0; i < tabCount; i++) {
      await client.click('.tabs .tab', i)
      await delay(1200)
      const content = await getTerminalContent(client)
      log(`021: tab ${i} tail: ${JSON.stringify(content.slice(-140))}`)
      expect(content.includes(cmd)).equal(true)
    }

    await closeApp(electronApp, __filename)
    log('021: action menu tests passed')
  })
})
