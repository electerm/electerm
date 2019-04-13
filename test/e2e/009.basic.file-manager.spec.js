/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()
const delay = require('./common/wait')
const generate = require('./common/uid')
const isOs = require('./common/is-os')

if (!isOs('darwin')) {
  return
}

describe('local file manager', function () {
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

  it('should open window and basic sftp works', async function() {
    const {client} = this.app

    await client.waitUntilWindowLoaded()
    await delay(500)

    //click sftp tab
    await client.execute(function() {
      document.querySelectorAll('.ssh-wrap-show .term-sftp-tabs .type-tab')[1].click()
    })
    await delay(2500)

    //make a local folder
    let localFileListBefore = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await client.execute(function() {
      document.querySelector('.context-menu .anticon-folder-add').click()
    })
    await delay(200)
    let fname = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    let localFileList = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList.value.length).equal(localFileListBefore.value.length + 1)

    //enter folder
    await client.execute(function() {
      let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
      })
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item')[1].dispatchEvent(event)
    })
    await delay(2000)
    let pathCurrentLocal = await client.getAttribute('.ssh-wrap-show .sftp-local-section .sftp-title input', 'value')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    let localFileList0 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList0.value.length).equal(1)

    //new file
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await client.execute(function() {
      document.querySelector('.context-menu .anticon-file-add').click()
    })
    await delay(200)
    let fname00 = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname00)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    let localFileList00 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList00.value.length).equal(2)

    //left click to highlight selection
    let selectedBefore = await client.elements('.ssh-wrap-show .sftp-item.selected')
    expect(selectedBefore.value.length).equal(0)
    await client.click('.ssh-wrap-show .sftp-table-content > .sftp-item', 10, 10)
    let selected = await client.elements('.ssh-wrap-show .sftp-table-content > .sftp-item.selected')
    expect(selected.value.length).equal(1)

    //select all and del Control
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await client.execute(function() {
      document.querySelector('.context-menu .anticon-check-square-o').click()
    })
    await delay(20)
    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(2000)
    let localFileList11 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList11.value.length).equal(1)

    //goto parent
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .sftp-local-section .anticon-arrow-up').click()
    })
    await delay(2000)
    let localFileList1 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList1.value.length).equal(localFileList.value.length)



    //del folder
    await client.execute(function() {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item')[1].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(2000)
    let localFileList2 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList2.value.length).equal(localFileListBefore.value.length)

  })

})

