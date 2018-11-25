const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const cwd = process.cwd()
const delay = require('./common/wait')
const {expect} = require('chai')

if (true) {
  return
}

describe('symbolic links support', function () {
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

  it('symbolic links support works', async function() {
    const {client} = this.app
    await client.waitUntilWindowLoaded()
    await delay(500)
    let tmp = 'tmp-' + (+new Date())
    let cmd = `mkdir ${tmp} && cd ${tmp} && touch x.js && mkdir xx && ln -s x.js xk && ln -s xx xxk`
    await delay(101)
    await client.keys([...cmd.split(''), 'Enter'])
    await delay(100)
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .term-sftp-tabs .fileManager').click()
    })
    await delay(300)
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .anticon-reload').click()
    })
    await delay(2500)
    await client.execute(function() {
      let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
      })
      document.querySelector('.ssh-wrap-show .sftp-table-content .sftp-item.local.directory .sftp-file-prop').dispatchEvent(event)
    })

    await delay(3000)
    let localFileList = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList.value.length).equal(5)
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .term-sftp-tabs .terminal').click()
    })
    await delay(300)
    let cmd1 = `cd .. && rm -rf ${tmp}`
    await client.keys([...cmd1.split(''), 'Enter'])
  })

})
