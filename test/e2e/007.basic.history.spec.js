const { Application } = require('spectron')
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')
const prefixer = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('history', function () {
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

  it('all buttons open proper history tab', async function () {
    const { client, electron } = this.app
    extendClient(client)
    const prefix = await prefixer(electron)
    const e = prefix('common')
    await client.waitUntilWindowLoaded()
    await delay(3500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    const sel = '.ant-modal .ant-tabs-nav-list .ant-tabs-tab-active'
    const active = await client.element(sel)
    expect(!!active.elementId).equal(true)
    const text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('tab it')
    await client.click('.ant-modal .ant-tabs-nav-list .ant-tabs-tab')

    await delay(1000)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('history'))

    log('auto focus works')
    const focus = await client.hasFocus('.ant-modal .ant-tabs-tabpane-active #ssh-form_host')
    expect(focus).equal(true)
    log('list tab')
    await client.click('.ant-modal .ant-tabs-tabpane-active .item-list-unit')
    const list1 = await client.getAttribute('.ant-modal .ant-tabs-tabpane-active .item-list-unit:nth-child(1)', 'class')
    expect(list1.includes('active'))
  })
})
