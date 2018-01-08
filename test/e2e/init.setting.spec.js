const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()
const {log} = console
const delay = time => new Promise(resolve => setTimeout(resolve, time))

describe('init setting buttons', function () {

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

  it('all buttons open proper setting tab', async function() {
    const { client } = this.app

    await client.waitUntilWindowLoaded()
    await delay(500)

    log('button:edit')
    await client.click('.btns .anticon-edit')
    let sel = '.ant-modal .ant-tabs-tab-active'
    let active = await client.element(sel)
    expect(!!active.value).equal(true)
    let text = await client.getText(sel)
    expect(text).equal('bookmarks')

    log('close')
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(900)

    log('open setting')
    await client.execute(function() {
      document.querySelector('.btns .anticon-setting').parentNode.click()
    })
    await delay(1500)
    let active1 = await client.element(sel)
    expect(!!active1.value).equal(true)
    let text1 = await client.getText(sel)
    expect(text1).equal('setting')
    log('close')
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(900)

    log('button:new ssh')
    await client.execute(function() {
      document.querySelector('.btns .anticon-plus').parentNode.click()
    })
    await delay(1000)
    let active2 = await client.element(sel)
    expect(!!active2.value).equal(true)
    let text2 = await client.getText(sel)
    expect(text2).equal('bookmarks')

    log('tab it')
    await client.execute(function() {
      document.querySelectorAll('.ant-modal .ant-tabs-tab')[2].click()
    })
    await delay(100)
    let text4 = await client.getText(sel)
    expect(text4).equal('setting')
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-modal-close').click()
    })
    await delay(600)

    log('button:edit again')
    await client.click('.btns .anticon-edit')
    await delay(600)
    let text5 = await client.getText(sel)
    expect(text5).equal('bookmarks')
  })

})
