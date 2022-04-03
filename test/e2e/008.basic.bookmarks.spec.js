
const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const prefixer = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('bookmarks', function () {
  it('all buttons open proper bookmark tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    const prefix = await prefixer(electron)
    const e = prefix('common')
    await delay(3500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(2500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    const text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('auto focus works')
    await client.hasFocus('.setting-wrap .ant-tabs-tabpane-active #ssh-form_host')

    log('default username = ""')
    const v = await client.getValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_username')
    expect(v).equal('')

    log('default port = 22')
    const v1 = await client.getValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_port')
    expect(v1).equal('22')

    log('save it')
    const bookmarkCountPrev = await client.evaluate(() => {
      return window.store.bookmarks.length
    })
    await client.setValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_host', TEST_HOST)
    await client.setValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_username', TEST_USER)
    await client.setValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_password', TEST_PASS)
    // const list0 = await client.elements('.setting-wrap .ant-tabs-tabpane-active .tree-item')
    await client.click('.setting-wrap .ant-tabs-tabpane-active .ant-form-item .ant-btn.ant-btn-ghost')
    await delay(1000)
    const bookmarkCount = await client.evaluate(() => {
      return window.store.bookmarks.length
    })
    // const list = await client.elements('.setting-wrap .ant-tabs-tabpane-active .tree-item')
    // await delay(100)
    expect(bookmarkCount).equal(bookmarkCountPrev + 1)

    log('list tab')
    await client.click('.setting-wrap .ant-tabs-tabpane-active .tree-item')
    // await delay(55555555)
    const list1 = await client.getAttribute('.setting-wrap .ant-tabs-tabpane-active .ant-tree-treenode', 'class')
    expect(list1.includes('ant-tree-treenode-selected'))

    // await delay(55555555)

    log('tab it')
    await client.click('.setting-wrap .ant-tabs-tab', 2)

    await delay(100)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))
  })
})
