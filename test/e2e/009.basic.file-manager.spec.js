/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { Application } = require('spectron')
const { expect } = require('chai')
const delay = require('./common/wait')
const generate = require('./common/uid')
const isOs = require('./common/is-os')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

if (!process.env.LOCAL_TEST && isOs('darwin')) {
  return
}

describe('local file manager', function () {
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

  it('should open window and basic sftp works', async function () {
    const { client } = this.app
    extendClient(client)
    await client.waitUntilWindowLoaded()
    await delay(3500)

    // click sftp tab
    await client.click('.ssh-wrap-show .term-sftp-tabs .type-tab', 1)
    await delay(2500)

    // make a local folder
    const localFileListBefore = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-local .virtual-file-unit', 10, 10)
    await delay(3200)
    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    const localFileList = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList.length).equal(localFileListBefore.length + 1)

    // enter folder
    await client.execute(function () {
      const event = new MouseEvent('dblclick', {
        view: window,
        bubbles: true,
        cancelable: true
      })
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item')[1].dispatchEvent(event)
    })
    await delay(2000)
    const pathCurrentLocal = await client.getValue('.ssh-wrap-show .sftp-local-section .sftp-title input')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    const localFileList0 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList0.length).equal(1)

    // new file
    await client.rightClick('.ssh-wrap-show .virtual-file-local .virtual-file-unit', 10, 10)
    await client.click('.context-menu .anticon-file-add')
    await delay(200)
    const fname00 = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname00)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    const localFileList00 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList00.length).equal(2)

    // left click to highlight selection
    const selectedBefore = await client.elements('.ssh-wrap-show .sftp-item.selected')
    expect(selectedBefore.length).equal(0)
    await client.execute(() => {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item .file-bg')[1].click()
    })
    await delay(200)
    const selected = await client.elements('.ssh-wrap-show .sftp-table-content > .sftp-item.selected')
    expect(selected.length).equal(1)

    // select all and del Control
    await client.rightClick('.ssh-wrap-show .virtual-file-local .virtual-file-unit', 10, 10)
    await client.click('.context-menu .anticon-check-square')
    await delay(20)
    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(2000)
    const localFileList11 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList11.length).equal(1)

    // goto parent
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .sftp-local-section .anticon-arrow-up').click()
    })
    await delay(2000)
    const localFileList1 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList1.length).equal(localFileList.length)

    // del folder
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item')[1].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(2000)
    const localFileList2 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList2.length).equal(localFileListBefore.length)
  })
})
