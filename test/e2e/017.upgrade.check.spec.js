const { Application } = require('spectron')
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('Upgrade check', function () {
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

  it('Upgrade check should work', async function () {
    const { client } = this.app
    client.element = client.$
    extendClient(client)
    await client.waitUntilWindowLoaded()
    await delay(2500)

    log('button:about')
    await client.click('.btns .open-about-icon')
    await delay(2500)
    const sel = '.ant-modal .ant-tabs-nav-list .ant-tabs-tab-active'
    const active = await client.element(sel)
    expect(!!active.elementId).equal(true)

    await client.click('.about-wrap .ant-btn-primary')
    await delay(3000)
    const up = await client.element('.upgrade-panel')
    expect(!!up.elementId).equal(true)
  })
})
