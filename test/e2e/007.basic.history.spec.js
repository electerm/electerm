const { Application } = require('spectron')
const delay = require('./common/wait')
const _ = require('lodash')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')

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

    log('tab it')
    await client.execute(function () {
      document.querySelectorAll('.ant-modal .ant-tabs-bar .ant-tabs-tab')[0].click()
    })

    await delay(100)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('history'))

    log('auto focus works')
    const focus = await client.hasFocus('.ant-modal .ant-tabs-tabpane-active #host')
    expect(focus).equal(true)
    log('list tab')
    await client.execute(function () {
      document.querySelectorAll('.ant-modal .ant-tabs-tabpane-active .item-list-unit')[1].click()
    })
    const list1 = await client.getAttribute('.ant-modal .ant-tabs-tabpane-active .item-list-unit:nth-child(1)', 'class')
    expect(list1.includes('active'))
  })
})
