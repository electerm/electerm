const { Application } = require('spectron')
const delay = require('./common/wait')
const { expect } = require('chai')
const appOptions = require('./common/app-options')

if (true) { // eslint-disable-line
  return
}

describe('symbolic links support', function () {
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

  it('symbolic links support works', async function () {
    const { client } = this.app
    await client.waitUntilWindowLoaded()
    await delay(3500)
    const tmp = 'tmp-' + (+new Date())
    const cmd = `mkdir ${tmp} && cd ${tmp} && touch x.js && mkdir xx && ln -s x.js xk && ln -s xx xxk`
    await delay(101)
    await client.keys([...cmd.split(''), 'Enter'])
    await delay(100)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .term-sftp-tabs .fileManager').click()
    })
    await delay(300)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .anticon-reload').click()
    })
    await delay(2500)
    await client.execute(function () {
      const event = new MouseEvent('dblclick', {
        view: window,
        bubbles: true,
        cancelable: true
      })
      document.querySelector('.ssh-wrap-show .sftp-table-content .sftp-item.local.directory .sftp-file-prop').dispatchEvent(event)
    })

    await delay(3000)
    const localFileList = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList.value.length).equal(5)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .term-sftp-tabs .terminal').click()
    })
    await delay(300)
    const cmd1 = `cd .. && rm -rf ${tmp}`
    await client.keys([...cmd1.split(''), 'Enter'])
  })
})
