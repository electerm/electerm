
const { Application } = require('spectron')
const delay = require('./common/wait')
const { expect } = require('chai')
const appOptions = require('./common/app-options')

describe('tabs', function () {
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

  it('add tab button works', async function () {
    const { client } = this.app
    await client.waitUntilWindowLoaded()
    await delay(500)
    const tabs = await client.elements('.tabs .tab')
    const tabsLenBefore = tabs.value.length
    await client.doubleClick('.tab')
    await delay(500)
    const tabs0 = await client.elements('.tabs .tab')
    expect(tabs0.value.length).equal(tabsLenBefore + 1)
    const wraps = await client.elements('.ui-outer > div')
    expect(wraps.value.length).equal(tabsLenBefore + 1)
    await delay(500)
  })

  it('double click to duplicate tab button works', async function () {
    const { client } = this.app
    await client.waitUntilWindowLoaded()
    await delay(500)
    const tabs = await client.elements('.tabs .tab')
    const tabsLenBefore = tabs.value.length
    await client.click('.tabs .tabs-add-btn')
    await delay(500)
    const tabs0 = await client.elements('.tabs .tab')
    expect(tabs0.value.length).equal(tabsLenBefore + 1)
    const wraps = await client.elements('.ui-outer > div')
    expect(wraps.value.length).equal(tabsLenBefore + 1)
    await delay(500)
  })
})
