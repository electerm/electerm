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

describe('bookmark groups', function () {
  it('all buttons open proper bookmark tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(2500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    const text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('click add category button')
    await client.click('.setting-wrap .anticon-folder.with-plus')

    const id = 'u567'
    await client.setValue('.setting-wrap .item-list-wrap input.ant-input', id)

    log('save it')
    const bookmarkGroupsCountPrev = await client.evaluate(() => {
      return window.store.bookmarkGroups.length
    })
    await delay(200)
    await client.click('.setting-wrap .ant-input-group-addon .anticon-check')
    await delay(1200)
    const bookmarkGroupsCount = await client.evaluate(() => {
      return window.store.bookmarkGroups.length
    })
    expect(bookmarkGroupsCountPrev + 1).equal(bookmarkGroupsCount)
    await client.evaluate(() => {
      return window.store.setBookmarkGroups(
        window.store.bookmarkGroups.filter(d => d !== 'u567')
      )
    })
    await electronApp.close().catch(console.log)
  })
})
