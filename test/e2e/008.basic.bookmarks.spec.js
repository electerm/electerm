const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const delay = require('./common/wait')
const cwd = process.cwd()
const _ = require('lodash')
const {log} = console
const {expect} = require('chai')

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')

describe('bookmarks', function () {

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

  it('all buttons open proper bookmark tab', async function() {
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

    log('auto focus works')
    let focus = await client.hasFocus('.ant-modal .ant-tabs-tabpane-active #host')
    expect(focus).equal(true)

    log('default username = ""')
    let v = await client.getValue('.ant-modal .ant-tabs-tabpane-active #username')
    expect(v).equal('')

    log('default port = 22')
    let v1 = await client.getValue('.ant-modal .ant-tabs-tabpane-active #port')
    expect(v1).equal('22')

    log('save it')
    await client.setValue('.ant-modal .ant-tabs-tabpane-active #host', TEST_HOST)
    await client.setValue('.ant-modal .ant-tabs-tabpane-active #username', TEST_USER)
    await client.setValue('.ant-modal .ant-tabs-tabpane-active #password', TEST_PASS)
    let list0 = await client.elements('.ant-modal .ant-tabs-tabpane-active .tree-item')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-tabpane-active .ant-form-item-children .ant-btn.ant-btn-ghost')[0].click()
    })
    let list = await client.elements('.ant-modal .ant-tabs-tabpane-active .tree-item')
    await delay(100)
    expect(list.value.length).equal(list0.value.length + 1)

    log('list tab')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-tabpane-active .ant-tree-child-tree-open .tree-item')[0].click()
    })
    //await delay(55555555)
    let list1 = await client.getAttribute('.ant-modal .ant-tabs-tabpane-active .ant-tree-child-tree-open .ant-tree-node-content-wrapper', 'class')
    expect(list1.includes('ant-tree-node-selected'))

    //await delay(55555555)

    log('tab it')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-tab')[2].click()
    })

    await delay(100)
    let text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))

  })

})
