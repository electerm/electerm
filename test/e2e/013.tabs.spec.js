

const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const delay = require('./common/wait')
const cwd = process.cwd()
const {expect} = require('chai')

describe('tabs', function () {
  this.timeout(100000)

  beforeEach(async function() {
    this.app = new Application({
      path: electronPath,
      webdriverOptions: {
        deprecationWarnings: false
      },
      args: [resolve(cwd, 'work/app'), '--no-session-restore']
    })
    return this.app.start()
  })

  afterEach(function() {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('add tab button works', async function() {
    const {client} = this.app
    await client.waitUntilWindowLoaded()
    await delay(500)
    let tabs = await client.elements('.tabs .tab')
    let tabsLenBefore = tabs.value.length
    await client.doubleClick('.tab')
    await delay(500)
    let tabs0 = await client.elements('.tabs .tab')
    expect(tabs0.value.length).equal(tabsLenBefore + 1)
    let wraps = await client.elements('.ui-outer > div')
    expect(wraps.value.length).equal(tabsLenBefore + 1)
    await delay(500)
  })

  it('double click to duplicate tab button works', async function() {
    const {client} = this.app
    await client.waitUntilWindowLoaded()
    await delay(500)
    let tabs = await client.elements('.tabs .tab')
    let tabsLenBefore = tabs.value.length
    await client.click('.tabs .tabs-add-btn')
    await delay(500)
    let tabs0 = await client.elements('.tabs .tab')
    expect(tabs0.value.length).equal(tabsLenBefore + 1)
    let wraps = await client.elements('.ui-outer > div')
    expect(wraps.value.length).equal(tabsLenBefore + 1)
    await delay(500)
  })

})
