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
const {log} = console
const {generate} = require('shortid')

describe('sftp basic', function () {
  this.timeout(100000)

  beforeEach(async function() {
    this.app = new Application({
      path: electronPath,
      args: [resolve(cwd, 'work/app'), '--no-session-restore'],
      webdriverOptions: {
        deprecationWarnings: false
      }
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
    let bookmarkCountPrev = await client.elements('.sidebar-list .bookmarks-panel .item-list-unit')
    let historyCountPrev = await client.elements('.sidebar-list .history-panel .item-list-unit')
    await delay(500)
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#host', TEST_HOST)
    await client.setValue('#username', TEST_USER)
    await client.setValue('#password', TEST_PASS)
    await delay(100)
    await client.execute(function() {
      document.querySelector('.ant-modal .ant-tabs-tabpane-active .ant-btn-primary').click()
    })
    await delay(500)
    let tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.value.length).equal(2)
    await delay(2010)

    //click sftp tab
    log('click sftp tab')
    await client.execute(function() {
      document.querySelectorAll('.ssh-wrap-show .term-sftp-tabs .type-tab')[1].click()
    })
    await delay(2500)

    //bookmark side panel works
    let bookmarkCount = await client.elements('.sidebar-list .bookmarks-panel .item-list-unit')

    expect(bookmarkCount.value.length).equal(bookmarkCountPrev.value.length + 1)

    //bookmark side panel works
    let historyCount = await client.elements('.sidebar-list .history-panel .item-list-unit')

    expect(historyCount.value.length).equal(historyCountPrev.value.length + 1)

    //make a local folder
    let localFileListBefore = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await delay(300)
    log('add folder')
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
    await delay(200)
    log('add file')
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

    //select all and del Control
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await delay(200)
    log('select all')
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
    await delay(20)
    log('goto parent')
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .sftp-local-section .anticon-arrow-up').click()
    })
    await delay(2000)
    let localFileList1 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList1.value.length).equal(localFileList.value.length)


    //del folder
    log('del folder')
    await client.execute(function() {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item')[1].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(3000)
    let localFileList2 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList2.value.length).equal(localFileListBefore.value.length)

    //remote test
    //make a remote folder
    let remoteFileListBefore = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-remote', 10, 10)
    await delay(200)
    await client.execute(function() {
      document.querySelector('.context-menu .anticon-folder-add').click()
    })
    await delay(200)
    let fname0 = '00000test-electerm-remote' + generate()
    await client.setValue('.ssh-wrap-show .sftp-remote-section .sftp-item input', fname0)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    let remoteFileList = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList.value.length).equal(remoteFileListBefore.value.length + 1)

    //enter folder
    await client.execute(function() {
      let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
      })
      document.querySelectorAll('.ssh-wrap-show .file-list.remote .sftp-item')[1].dispatchEvent(event)
    })
    await delay(2000)
    let pathCurrentRemote = await client.getAttribute('.ssh-wrap-show .sftp-remote-section .sftp-title input', 'value')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    let remoteFileList0 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')

    expect(remoteFileList0.value.length).equal(1)

    //goto parent
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .sftp-remote-section .anticon-arrow-up').click()
    })
    await delay(2000)
    let remoteFileList1 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList1.value.length).equal(remoteFileList.value.length)

    //del folder
    await client.execute(function() {
      document.querySelectorAll('.ssh-wrap-show .file-list.remote .sftp-item .sftp-file-prop')[0].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(3000)
    let remoteFileList2 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList2.value.length).equal(remoteFileListBefore.value.length)

  })

})

