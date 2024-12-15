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
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const e = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('bookmarks', function () {
  it('all buttons open proper bookmark tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(2500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    const text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('auto focus works')
    await client.hasFocus('.setting-wrap #ssh-form_host')

    log('default username = ""')
    const v = await client.getValue('.setting-wrap #ssh-form_username')
    expect(v).equal('')

    log('default port = 22')
    const v1 = await client.getValue('.setting-wrap #ssh-form_port')
    expect(v1).equal('22')

    log('save it')
    const bookmarkCountPrev = await client.evaluate(() => {
      return window.store.bookmarks.length
    })
    await client.setValue('.setting-wrap #ssh-form_host', TEST_HOST)
    await client.setValue('.setting-wrap #ssh-form_username', TEST_USER)
    await client.setValue('.setting-wrap #ssh-form_password', TEST_PASS)
    // const list0 = await client.elements('.setting-wrap .tree-item')
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(1000)
    const bookmarkCount = await client.evaluate(() => {
      return window.store.bookmarks.length
    })
    // const list = await client.elements('.setting-wrap .tree-item')
    // await delay(100)
    expect(bookmarkCount).equal(bookmarkCountPrev + 1)

    // log('list tab')
    // await client.click('.setting-wrap .tree-item')
    // // await delay(55555555)
    // const list1 = await client.getAttribute('.setting-wrap .ant-tree-treenode', 'class')
    // expect(list1.includes('ant-tree-treenode-selected'))

    // await delay(55555555)

    // log('tab it')
    // await client.click('.setting-wrap .ant-tabs-tab', 2)

    // await delay(100)
    // const text4 = await client.getText(sel)
    // expect(text4).equal(e('setting'))
    // await electronApp.close().catch(console.log)
  })
})
