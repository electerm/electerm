/**
 * chrome-style bookmark bar under the tab strip
 *
 * Toggled from the left sidebar icon bar, rendered as the second row of each
 * pane's header: the default group's bookmarks inline, other top-level groups
 * as folders with a dropdown.
 *
 * Runs against its own DATA_PATH so the seeded bookmarks never touch the
 * developer's real bookmark database (the suite passes no DATA_PATH of its own).
 */

const { mkdtempSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const { _electron: electron } = require('@playwright/test')
const {
  test: it,
  expect
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const extendClient = require('./common/client-extend')

const baseOptions = require('./common/app-options')
const launchEnv = { ...baseOptions.env }
// an IDE terminal exports this and Electron then starts as plain node
delete launchEnv.ELECTRON_RUN_AS_NODE
const appOptions = {
  ...baseOptions,
  env: {
    ...launchEnv,
    DATA_PATH: mkdtempSync(join(tmpdir(), 'electerm-bookmark-bar-'))
  }
}

let client

function seed () {
  return client.evaluate(() => {
    const s = window.store
    s.setBookmarks([
      { id: 'bb-e2e-b1', title: 'bb-e2e-b1', type: 'local' },
      { id: 'bb-e2e-b2', title: 'bb-e2e-b2', type: 'local' }
    ])
    s.setItems('bookmarkGroups', [
      { id: 'default', title: 'Default', bookmarkIds: ['bb-e2e-b1'], bookmarkGroupIds: ['bb-e2e-cat'] },
      { id: 'bb-e2e-cat', title: 'bb-e2e-cat', bookmarkIds: ['bb-e2e-b2'] }
    ])
  })
}

const barItems = () => client.evaluate(() => {
  return [...document.querySelectorAll('.bookmark-bar [data-bar-key]')].map(el => ({
    text: el.textContent.trim(),
    folder: el.classList.contains('bookmark-bar-folder')
  }))
})

const sessionPadding = () => client.evaluate(() => {
  const el = document.querySelector('.session-wrap.session-batch-active')
  return el ? window.getComputedStyle(el).paddingTop : null
})

describe('bookmark bar', function () {
  it('toggles the chrome-style bar and opens bookmarks from it', async function () {
    const electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3000)
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1400, 900)
    })
    await delay(1000)

    log('seed one bookmark and one category')
    await seed()
    await delay(1500)
    expect(await client.evaluate(() => window.store.bookmarks.length)).toEqual(2)
    expect(await client.elemExist('.bookmark-bar')).toEqual(false)

    log('the sidebar icon shows the bar')
    await client.click('.bookmark-bar-toggle')
    await delay(800)
    const items = await barItems()
    // the default group is expanded inline, so its category is a folder item
    // and its bookmark sits next to it
    expect(items.length).toEqual(2)
    expect(items[0].folder).toEqual(true)
    expect(items[0].text).toEqual('bb-e2e-cat')
    expect(items[1].folder).toEqual(false)
    expect(items[1].text).toContain('bb-e2e-b1')

    log('the bar takes its own row under the tab strip')
    const geo = await client.evaluate(() => {
      const r = document.querySelector('.bookmark-bar').getBoundingClientRect()
      return { top: Math.round(r.top), height: Math.round(r.height) }
    })
    expect(geo).toEqual({ top: 36, height: 28 })
    // 36px tab strip + 28px bar
    expect(await sessionPadding()).toEqual('64px')

    log('the folder opens its contents in a dropdown')
    await client.click('.bookmark-bar-folder')
    await delay(600)
    const menuText = await client.evaluate(() => {
      const open = [...document.querySelectorAll('.ant-dropdown')]
        .find(d => d.getBoundingClientRect().width > 0)
      return open ? open.textContent : ''
    })
    expect(menuText).toContain('bb-e2e-b2')
    await client.keyboard.press('Escape')
    await delay(300)

    log('clicking a bookmark opens a session in this pane')
    const before = await client.evaluate(() => window.store.tabs.length)
    await client.click('.bookmark-bar-item:not(.bookmark-bar-folder)')
    await delay(2500)
    const after = await client.evaluate(() => ({
      tabs: window.store.tabs.length,
      batch: window.store.tabs[window.store.tabs.length - 1].batch,
      leaked: window.openTabBatch !== undefined
    }))
    expect(after.tabs).toEqual(before + 1)
    expect(after.batch).toEqual(0)
    expect(after.leaked).toEqual(false)

    log('toggling it off gives the space back')
    await client.click('.bookmark-bar-toggle')
    await delay(800)
    expect(await client.elemExist('.bookmark-bar')).toEqual(false)
    expect(await sessionPadding()).toEqual('36px')

    log('the choice survives a reload')
    await client.click('.bookmark-bar-toggle')
    await delay(600)
    await client.reload()
    await delay(6000)
    expect(
      await client.evaluate(() => window.store.bookmarkBarVisible)
    ).toEqual(true)
    expect(await client.elemExist('.bookmark-bar')).toEqual(true)
    await electronApp.close()
  })
})
