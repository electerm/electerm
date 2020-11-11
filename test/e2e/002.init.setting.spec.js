const { Application } = require('spectron')
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')
const prefixer = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('init setting buttons', function () {
  this.timeout(100000)

  beforeEach(async function () {
    this.app = new Application(appOptions)
    return this.app.start()
  })

  afterEach(async function () {
    if (this.app && this.app.isRunning()) {
      await this.app.stop()
      return true
    }
  })

  it('all buttons open proper setting tab', async function () {
    const { client, electron } = this.app
    client.element = client.$
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

    log('close')
    await client.execute(function () {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(900)

    log('open setting')
    await client.execute(function () {
      document.querySelector('.btns .anticon-setting').click()
    })
    await delay(1500)
    const active1 = await client.element(sel)
    expect(!!active1.elementId).equal(true)
    const text1 = await client.getText(sel)
    expect(text1).equal(e('setting'))
    log('close')
    await client.click('.ant-modal .ant-modal-close')
    await delay(900)

    log('button:new ssh')
    await client.click('.btns .anticon-plus-circle')
    await delay(1000)
    const active2 = await client.element(sel)
    expect(!!active2.elementId).equal(true)
    const text2 = await client.getText(sel)
    expect(text2).equal(e('bookmarks'))

    log('tab it')
    await client.click('.ant-modal .ant-tabs-tab:nth-child(3)')
    await delay(100)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))
    await client.click('.ant-modal .ant-modal-close')
    await delay(600)

    log('button:edit again')
    await client.click('.btns .anticon-plus-circle')
    await delay(600)
    const text5 = await client.getText(sel)
    expect(text5).equal(e('bookmarks'))
  })
})
