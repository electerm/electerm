/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()
const delay = require('./common/wait')
const basicTermTest = require('./common/basic-terminal-test')

describe('ssh', function () {
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

  it('should open window and basic ssh ls command works', async function() {
    const {client} = this.app
    let cmd = 'ls'
    await client.waitUntilWindowLoaded()
    await delay(500)
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#host', TEST_HOST)
    await client.setValue('#username', TEST_USER)
    await client.setValue('#password', TEST_PASS)
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-tabs-tabpane-active .ant-btn-primary').click()
    })
    await delay(1500)
    let tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.value.length).equal(2)
    await delay(2010)
    await basicTermTest(this, client, cmd)

  })

})

