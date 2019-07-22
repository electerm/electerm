const { Application } = require('spectron')
const delay = require('./common/wait')
const _ = require('lodash')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')

describe('init setting buttons', function () {
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

  it('all buttons open proper setting tab', async function () {
    const { client, electron } = this.app
    const { lang } = await electron.remote.getGlobal('et')
    const prefix = prefix => {
      return (id) => {
        return _.get(lang, `${prefix}.${id}`) || id
      }
    }
    const e = prefix('common')
    await client.waitUntilWindowLoaded()
    await delay(500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    const sel = '.ant-modal .ant-tabs-line > .ant-tabs-bar .ant-tabs-tab-active'
    const active = await client.element(sel)
    expect(!!active.value).equal(true)
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
    expect(!!active1.value).equal(true)
    const text1 = await client.getText(sel)
    expect(text1).equal(e('setting'))
    log('close')
    await client.execute(function () {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(900)

    log('button:new ssh')
    await client.execute(function () {
      document.querySelector('.btns .anticon-plus-circle').click()
    })
    await delay(1000)
    const active2 = await client.element(sel)
    expect(!!active2.value).equal(true)
    const text2 = await client.getText(sel)
    expect(text2).equal(e('bookmarks'))

    log('tab it')
    await client.execute(function () {
      document.querySelectorAll('.ant-modal .ant-tabs-tab')[2].click()
    })
    await delay(100)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))
    await client.execute(function () {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(600)

    log('button:edit again')
    await client.click('.btns .anticon-plus-circle')
    await delay(600)
    const text5 = await client.getText(sel)
    expect(text5).equal(e('bookmarks'))
  })
})
