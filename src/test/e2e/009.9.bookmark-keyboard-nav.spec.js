/**
 * bookmark list keyboard navigation
 * arrow up/down moves a cursor row, enter toggles a category or opens a bookmark
 *
 * runs against its own DATA_PATH so the seeded bookmark data never touches the
 * developer's real bookmark database
 */

const fs = require('fs')
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
    DATA_PATH: mkdtempSync(join(tmpdir(), 'electerm-kbd-nav-'))
  }
}

const sidebarWrap = '.sidebar-panel-bookmarks .item-list-wrap'
const settingWrap = '.setting-wrap .tree-list .item-list-wrap'

let client

function kbId (scope) {
  return client.evaluate(sel => {
    const el = document.querySelector(`${sel} .tree-item.kb-selected`)
    return el ? el.getAttribute('data-item-id') : null
  }, scope)
}

function listHasFocus (scope) {
  return client.evaluate(sel => {
    return document.activeElement === document.querySelector(sel)
  }, scope)
}

function seed () {
  return client.evaluate(() => {
    const s = window.store
    s.setItems('bookmarks', [
      { id: 'kb-e2e-b1', title: 'kb-e2e-b1', type: 'local' },
      { id: 'kb-e2e-b2', title: 'kb-e2e-b2', type: 'local' }
    ])
    s.setItems('bookmarkGroups', [
      { id: 'default', title: 'Default', bookmarkIds: ['kb-e2e-b1'] },
      { id: 'kb-e2e-cat', title: 'kb-e2e-cat', bookmarkIds: ['kb-e2e-b2'] }
    ])
    s.expandedKeys = ['default']
    s.pinned = true
    s.setOpenedSideBar('bookmarks')
  })
}

describe('bookmark keyboard nav', function () {
  it('arrow keys and enter drive the bookmark list', async function () {
    const electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3000)
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1400, 900)
    })

    log('seed one category and one bookmark')
    await seed()
    await delay(1800)

    log('click the list empty area to give it focus')
    const box = await client.locator(sidebarWrap).boundingBox()
    await client.mouse.click(box.x + 20, box.y + box.height - 12)
    await delay(400)
    expect(await listHasFocus(sidebarWrap)).toEqual(true)

    log('arrow keys walk the rows')
    // rows: default, kb-e2e-b1, kb-e2e-cat (collapsed)
    await client.keyboard.press('ArrowDown')
    await delay(250)
    expect(await kbId(sidebarWrap)).toEqual('default')
    await client.keyboard.press('ArrowDown')
    await delay(250)
    expect(await kbId(sidebarWrap)).toEqual('kb-e2e-b1')
    await client.keyboard.press('ArrowUp')
    await delay(250)
    expect(await kbId(sidebarWrap)).toEqual('default')

    log('enter toggles the category')
    await client.keyboard.press('ArrowDown')
    await delay(200)
    await client.keyboard.press('ArrowDown')
    await delay(200)
    expect(await kbId(sidebarWrap)).toEqual('kb-e2e-cat')
    await client.keyboard.press('Enter')
    await delay(600)
    expect(
      await client.evaluate(() => window.store.expandedKeys)
    ).toContain('kb-e2e-cat')
    // the child row shows up and the cursor stays on the category
    const afterExpand = await client.evaluate(() => {
      const rows = [...document.querySelectorAll('.sidebar-panel-bookmarks .tree-item')]
        .map(el => el.getAttribute('data-item-id'))
      const sel = document.querySelector('.sidebar-panel-bookmarks .tree-item.kb-selected')
      return {
        ids: rows,
        selected: sel ? sel.getAttribute('data-item-id') : null
      }
    })
    expect(afterExpand.ids).toContain('kb-e2e-b2')
    expect(afterExpand.selected).toEqual('kb-e2e-cat')
    await client.keyboard.press('Enter')
    await delay(600)
    expect(
      await client.evaluate(() => window.store.expandedKeys)
    ).not.toContain('kb-e2e-cat')

    log('enter opens the bookmark')
    // the category is collapsed again, so open it once more to reach its row
    await client.keyboard.press('Enter')
    await delay(600)
    await client.keyboard.press('ArrowDown')
    await delay(200)
    expect(await kbId(sidebarWrap)).toEqual('kb-e2e-b2')
    const spy = await client.evaluate(() => {
      const orig = window.store.onSelectBookmark
      if (typeof orig !== 'function') return 'no such method'
      window.__picked = []
      window.store.onSelectBookmark = function (id) {
        window.__picked.push(id)
        return orig.call(this, id)
      }
      return window.store.onSelectBookmark === orig ? 'assign ignored' : 'ok'
    })
    expect(spy).toEqual('ok')
    await client.keyboard.press('Enter')
    await delay(800)
    expect(await client.evaluate(() => window.__picked)).toEqual(['kb-e2e-b2'])

    log('settings bookmarks tab')
    await client.evaluate(() => {
      window.store.openSetting()
    })
    await delay(2500)
    await client.evaluate(() => {
      window.store.handleChangeSettingTab('bookmarks')
    })
    await delay(1500)
    const sBox = await client.locator(settingWrap).boundingBox()
    await client.mouse.click(sBox.x + 20, sBox.y + sBox.height - 12)
    await delay(400)
    await client.locator(settingWrap).hover()
    await client.keyboard.press('ArrowDown')
    await delay(250)
    await client.keyboard.press('ArrowDown')
    await delay(250)
    expect(await kbId(settingWrap)).toEqual('kb-e2e-b1')
    await client.keyboard.press('Enter')
    await delay(700)
    expect(
      await client.evaluate(() => window.store.settingItem.id)
    ).toEqual('kb-e2e-b1')

    log('typing in the inline category editor does not navigate')
    await client.hover('.setting-wrap .tree-item[data-item-id="kb-e2e-cat"]')
    await delay(300)
    await client.click(
      '.setting-wrap .tree-list-row-group:has(.tree-item[data-item-id="kb-e2e-cat"]) .edit-icon'
    )
    await delay(700)
    const editorInput = '.setting-wrap .tree-list .tree-list-editor-overlay input'
    expect(await client.countElem(editorInput)).toEqual(1)
    const kbBefore = await kbId(settingWrap)
    await client.click(editorInput)
    await client.keyboard.press('ArrowDown')
    await client.keyboard.press('ArrowUp')
    await client.keyboard.type('ZZ')
    await delay(400)
    expect(await kbId(settingWrap)).toEqual(kbBefore)
    expect(await client.getValue(editorInput)).toContain('ZZ')
    await client.keyboard.press('Enter')
    await delay(500)
    expect(
      await client.evaluate(() => {
        return window.store.bookmarkGroups
          .find(g => g.id === 'kb-e2e-cat').title
      })
    ).toContain('ZZ')

    log('search box arrows still walk the matches')
    await client.evaluate(() => window.store.hideSettingModal())
    await delay(800)
    await client.click('.sidebar-panel-bookmarks .tree-sort-wrap input')
    await client.fill('.sidebar-panel-bookmarks .tree-sort-wrap input', 'kb-e2e-b1')
    await delay(900)
    await client.keyboard.press('ArrowDown')
    await delay(300)
    expect(await kbId(sidebarWrap)).toEqual('kb-e2e-b1')

    fs.rmSync(appOptions.env.DATA_PATH, { recursive: true, force: true })
    await electronApp.close().catch(console.log)
  })
})
