const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('./common/expect')
const appOptions = require('./common/app-options')
const e = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('history', function () {
  it('all buttons open proper history tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)

    await client.evaluate(() => {
      return window.store.setLayout('c1')
    })

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(3500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    await delay(1500)
    const text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('tab it')
    await client.click('.setting-wrap .ant-tabs-nav-list .ant-tabs-tab')

    await delay(5000)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('history'))

    log('auto focus works')
    log('list tab')
    const hl = await client.evaluate(() => {
      return window.store.history.length
    })
    expect(hl > 0).equal(true)
    await client.click('.setting-wrap .item-list-unit')
    const list1 = await client.getAttribute('.setting-wrap .item-list-unit:nth-child(1)', 'class')
    expect(list1.includes('active')).equal(true)
    await electronApp.close().catch(console.log)
  })
})
