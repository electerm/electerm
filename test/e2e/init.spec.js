const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()

const delay = time => new Promise(resolve => setTimeout(resolve, time))

describe('main window', function () {
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

  it('should open window', async function() {
    const { client, browserWindow } = this.app

    await client.waitUntilWindowLoaded()
    await delay(500)
    const title = await browserWindow.getTitle()
    console.log(title, 'title')
    expect(title).equal('electerm')
  })

  it('should haven\'t any logs in console of main window', async function() {
    const { client } = this.app
    const logs = await client.getRenderProcessLogs()
    // Print renderer process logs
    logs.forEach(log => {
      console.log(log.message)
      console.log(log.source)
      console.log(log.level)
    })
    expect(logs).to.have.lengthOf(0)
  })

  it('dom should be ready', async function () {
    const { client } = this.app

    let wrap = await  client.element('#outside-context')
    expect(!!wrap.value).equal(true)
    let tabs = await client.element('.tabs')
    expect(!!tabs.value).equal(true)
    let term = await client.element('.xterm')
    expect(!!term.value).equal(true)
  })

  //terminal xterm xterm-theme-default xterm-cursor-style-block

  // it('can add new terminal', async function () {
  //   const { client } = this.app

  //   let edit = await client.element('.btns .anticon-edit')
  //   console.log(edit)
  //   expect(!!edit.value).equal(true)
  //   await client.elementIdClick(edit)
  //   let modal = await client.element('.ant-modal')
  //   expect(!!modal.value).equal(true)
  //   let active = await client.element('.ant-modal .ant-tabs-tab-active')
  //   expect(!!active.value).equal(true)
  //   let label = await active.getText()
  //   expect(label).equal('bookmarks')
  // })

})
