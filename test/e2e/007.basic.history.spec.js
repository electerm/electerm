const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const delay = require('./common/wait')
const cwd = process.cwd()
const _ = require('lodash')
const {log} = console
const {expect} = require('chai')

describe('history', function () {

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

  it('all buttons open proper history tab', async function() {
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

    log('tab it')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-bar .ant-tabs-tab')[0].click()
    })

    await delay(100)
    let text4 = await client.getText(sel)
    expect(text4).equal(e('history'))

    log('auto focus works')
    let focus = await client.hasFocus('.ant-modal .ant-tabs-tabpane-active #host')
    expect(focus).equal(true)
    log('list tab')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-tabpane-active .item-list-unit')[1].click()
    })
    let list1 = await client.getAttribute('.ant-modal .ant-tabs-tabpane-active .item-list-unit:nth-child(1)', 'class')
    expect(list1.includes('active'))



  })

})
