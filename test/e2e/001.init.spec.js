const {
  Application
} = require('spectron')
const delay = require('./common/wait')
const {
  expect
} = require('chai')
const packInfo = require('../../package.json')
const log = require('./common/log')
const isOs = require('./common/is-os')
const appOptions = require('./common/app-options')

if (isOs('darwin')) {
  return
}

describe('main window', function () {
  this.timeout(100000)

  beforeEach(function () {
    this.app = new Application(appOptions)
    return this.app.start()
  })

  afterEach(function () {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('should open window and buttons works', async function () {
    const {
      client,
      browserWindow
    } = this.app

    await client.waitUntilWindowLoaded()
    await delay(500)
    const { $ } = client
    client.click = (sel) => {
      $(sel).click()
    }

    log('title')
    const title = await browserWindow.getTitle()
    expect(title).includes(packInfo.name)

    log('elements')
    const wrap = await $('#outside-context')
    console.log(wrap)
    expect(!!wrap.value).equal(true)
    const tabs = await $('.tabs')
    expect(!!tabs.value).equal(true)
    const term = await $('.xterm')
    expect(!!term.value).equal(true)

    log('button click')

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    const active = await $('.ant-modal .ant-tabs-line > .ant-tabs-nav-list .ant-tabs-tab-active')
    expect(!!active.value).equal(true)

    log('button:close modal')
    await client.execute(function () {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    // await client.click('.ant-modal-close')
    await delay(900)
    const isVisible = await client.isVisible('.ant-modal')
    expect(isVisible).equal(false)

    log('button:about')
    await client.click('.btns .anticon-info-circle-o')
    const c = await $('.ant-modal.ant-modal-confirm')
    expect(!!c.value).equal(true)

    log('button:close info modal')
    await client.execute(function () {
      document.querySelector('.ant-modal.ant-modal-confirm .ant-modal-confirm-btns button').click()
    })
    await delay(900)
    const isVisible2 = await client.isVisible('.ant-modal.ant-modal-confirm')
    expect(isVisible2).equal(false)

    log('button:add new tab')
    await client.click('.tabs .tabs-add-btn')
    await delay(900)
    const count = await $('.tabs .tab')

    expect(count.value.length).equal(2)
  })
})
