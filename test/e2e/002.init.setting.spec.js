const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const delay = require('./common/wait')
const cwd = process.cwd()
const _ = require('lodash')
const {log} = console
const {expect} = require('chai')

describe('init setting buttons', function () {

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

  it('all buttons open proper setting tab', async function() {
    const { client, electron } = this.app
    let {lang} = await electron.remote.getGlobal('et')
    let prefix = prefix => {
      return (id) => {
        return _.get(lang, `${prefix}.${id}`) || id
      }
    }
    let e = prefix('common')
    await client.waitUntilWindowLoaded()
    await delay(500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    let sel = '.ant-modal .ant-tabs-line > .ant-tabs-bar .ant-tabs-tab-active'
    let active = await client.element(sel)
    expect(!!active.value).equal(true)
    let text = await client.getText(sel)
    expect(text).equal(e('bookmarks'))

    log('close')
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(900)

    log('open setting')
    await client.execute(function() {
      document.querySelector('.btns .anticon-setting').click()
    })
    await delay(1500)
    let active1 = await client.element(sel)
    expect(!!active1.value).equal(true)
    let text1 = await client.getText(sel)
    expect(text1).equal(e('setting'))
    log('close')
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(900)

    log('button:new ssh')
    await client.execute(function() {
      document.querySelector('.btns .anticon-plus-circle').click()
    })
    await delay(1000)
    let active2 = await client.element(sel)
    expect(!!active2.value).equal(true)
    let text2 = await client.getText(sel)
    expect(text2).equal(e('bookmarks'))

    log('tab it')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-tab')[2].click()
    })
    await delay(100)
    let text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(600)

    log('button:edit again')
    await client.click('.btns .anticon-plus-circle')
    await delay(600)
    let text5 = await client.getText(sel)
    expect(text5).equal(e('bookmarks'))
  })

})
