const { Application } = require('spectron')
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
  this.timeout(100000)

  beforeEach(async function () {
    this.app = new Application(appOptions)
    return this.app.start()
  })

  afterEach(function () {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('all buttons open proper bookmark tab', async function () {
    const { client, electron } = this.app
    extendClient(client)
    const prefix = await prefixer(electron)
    const e = prefix('common')
    await client.waitUntilWindowLoaded()
    await delay(3500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(3500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    const active = await client.element(sel)
    expect(!!active.elementId).equal(true)
    const text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('auto focus works')
    const focus = await client.hasFocus('.setting-wrap .ant-tabs-tabpane-active #ssh-form_host')
    expect(focus).equal(true)

    log('default username = ""')
    const v = await client.getValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_username')
    expect(v).equal('')

    log('default port = 22')
    const v1 = await client.getValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_port')
    expect(v1).equal('22')

    log('save it')
    await client.setValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_host', TEST_HOST)
    await client.setValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_username', TEST_USER)
    await client.setValue('.setting-wrap .ant-tabs-tabpane-active #ssh-form_password', TEST_PASS)
    const list0 = await client.elements('.setting-wrap .ant-tabs-tabpane-active .tree-item')
    await client.click('.setting-wrap .ant-tabs-tabpane-active .ant-form-item .ant-btn.ant-btn-ghost')
    const list = await client.elements('.setting-wrap .ant-tabs-tabpane-active .tree-item')
    await delay(100)
    expect(list.length).equal(list0.length + 1)

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
