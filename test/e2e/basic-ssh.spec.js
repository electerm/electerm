/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = process.env

if (!TEST_HOST || !TEST_PASS || !TEST_USER) {
  throw new Error(`
    basic ssh test need TEST_HOST TEST_PASS TEST_USER env set,
    you can run theselines(replace xxxx with real ones) to set env:
    export TEST_HOST=xxxx.xxx && export TEST_PASS=xxxxxx && export TEST_USER=xxxxxx
  `)
}

const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()
const delay = time => new Promise(resolve => setTimeout(resolve, time))

describe('ssh', function () {
  this.timeout(100000)

  beforeEach(async function() {
    this.app = new Application({
      path: electronPath,
      args: [resolve(cwd, 'work/app')]
    })
    return this.app.start()
  })

  afterEach(function() {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('should open window and basic ssh ls/dir command works', async function() {
    const {client} = this.app
    let cmd = 'ls'
    await client.waitUntilWindowLoaded()
    await delay(500)
    await client.click('.btns .anticon-edit')
    await delay(500)
    await client.setValue('#host', TEST_HOST)
    await client.setValue('#username', TEST_USER)
    await client.setValue('#password', TEST_PASS)
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-tabs-tabpane-active .ant-btn-primary').click()
    })
    await delay(500)
    let tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.value.length).equal(2)
    await delay(2010)
    await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)

    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[0].click()
    })
    let text1 = await this.app.electron.clipboard.readText()
    await delay(101)
    await client.keys([...cmd.split(''), 'Enter'])
    await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)

    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[0].click()
    })
    let text2 = await this.app.electron.clipboard.readText()
    expect(text1.trim().length).lessThan(text2.trim().length)

  })

})

