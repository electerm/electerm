/**
 * tab pin test
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

describe('tab-pin', function () {
  it('should render pinned tab first in tabs list', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)

    // create a second tab so there is a non-head tab to pin
    await client.openContextMenu('.tabs .tab')
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New tab")')
    await delay(2000)

    const before = await client.evaluate(() => {
      const tabs = window.store.tabs
      return {
        count: tabs.length,
        ids: tabs.map(t => t.id)
      }
    })
    expect(before.count).equal(2)

    // pin the second tab
    await client.openContextMenu(`.tabs .tab[data-id="${before.ids[1]}"]`)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-pushpin')
    await delay(1000)

    const afterPin = await client.evaluate(() => {
      return {
        ids: window.store.tabs.map(t => t.id),
        isPinned: window.store.tabs.map(t => !!t.isPinned),
        firstDomTabId: document.querySelector('.tabs-wrapper .tab').getAttribute('data-id')
      }
    })
    expect(afterPin.ids).deep.equal(before.ids) // store.tabs order untouched
    expect(afterPin.isPinned).deep.equal([false, true])
    expect(afterPin.firstDomTabId).equal(before.ids[1]) // pinned renders first

    // a newly created tab renders after the pinned tab
    await client.openContextMenu('.tabs .tab')
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New tab")')
    await delay(2000)

    const afterAdd = await client.evaluate(() => {
      const domIds = Array.from(document.querySelectorAll('.tabs-wrapper .tab')).map(d => d.getAttribute('data-id'))
      return {
        count: window.store.tabs.length,
        domIds
      }
    })
    expect(afterAdd.count).equal(3)
    expect(afterAdd.domIds[0]).equal(before.ids[1])
    expect(afterAdd.domIds[1]).equal(before.ids[0])

    // unpin: tab returns to its original position
    await client.openContextMenu(`.tabs .tab[data-id="${before.ids[1]}"]`)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-pushpin')
    await delay(1000)

    const afterUnpin = await client.evaluate(() => {
      return {
        ids: window.store.tabs.map(t => t.id),
        isPinned: window.store.tabs.map(t => !!t.isPinned),
        domIds: Array.from(document.querySelectorAll('.tabs-wrapper .tab')).map(d => d.getAttribute('data-id'))
      }
    })
    expect(afterUnpin.isPinned).deep.equal([false, false, false])
    expect(afterUnpin.domIds).deep.equal(afterUnpin.ids)

    await electronApp.close().catch(console.log)
  })
})
