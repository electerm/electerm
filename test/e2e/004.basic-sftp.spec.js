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
const { expect } = require('chai')
const delay = require('./common/wait')
const log = require('./common/log')
const { generate } = require('shortid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('sftp basic', function () {
  this.timeout(10000000)

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
    const bookmarkCountPrev = await client.elements('.sidebar-list .bookmarks-panel .item-list-unit')
    const historyCountPrev = await client.elements('.sidebar-list .history-panel .item-list-unit')
    await delay(500)
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#host', TEST_HOST)
    await client.setValue('#username', TEST_USER)
    await client.setValue('#password', TEST_PASS)
    await delay(100)
    await client.execute(function () {
      document.querySelector('.ant-modal .ant-tabs-tabpane-active .ant-btn-primary').click()
    })
    await delay(1500)
    const tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.length).equal(2)
    await delay(4010)

    // click sftp tab
    log('click sftp tab')
    await client.click('.ssh-wrap-show .term-sftp-tabs .type-tab', 1)
    await delay(2500)

    // bookmark side panel works
    const bookmarkCount = await client.elements('.sidebar-list .bookmarks-panel .item-list-unit')

    expect(bookmarkCount.length).equal(bookmarkCountPrev.length + 1)

    // bookmark side panel works
    await delay(4500)
    const historyCount = await client.elements('.sidebar-list .history-panel .item-list-unit')

    log(historyCount.length, historyCountPrev.length)
    // expect(historyCount.length).equal(historyCountPrev.length + 1)

    // make a local folder
    const localFileListBefore = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await delay(300)
    log('add folder')

    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    const localFileList = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList.length).equal(localFileListBefore.length + 1)

    // enter folder
    await client.doubleClick('.ssh-wrap-show .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg')
    await delay(2000)
    const pathCurrentLocal = await client.getValue('.ssh-wrap-show .sftp-local-section .sftp-title input')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    const localFileList0 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList0.length).equal(1)

    // new file
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await delay(200)
    log('add file')
    await client.click('.context-menu .anticon-file-add')
    await delay(200)
    const fname00 = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname00)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    const localFileList00 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList00.length).equal(2)

    // select all and del Control
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await delay(200)
    log('select all')
    await client.click('.context-menu .anticon-check-square-o')
    await delay(20)
    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(2000)
    const localFileList11 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList11.length).equal(1)

    // goto parent
    await delay(20)
    log('goto parent')
    await client.click('.ssh-wrap-show .sftp-local-section .anticon-arrow-up')
    await delay(2000)
    const localFileList1 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList1.length).equal(localFileList.length)

    // del folder
    log('del folder')
    await delay(100)
    await client.execute(() => {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item .file-bg')[1].click()
    })
    await delay(200)

    await client.keys(['Delete'])
    await delay(260)
    await client.keys(['Enter'])
    await delay(3000)
    const localFileList2 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList2.length).equal(localFileListBefore.length)

    // remote test
    // make a remote folder
    const remoteFileListBefore = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-remote', 10, 10)
    await delay(200)
    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname0 = '00000test-electerm-remote' + generate()
    await client.setValue('.ssh-wrap-show .sftp-remote-section .sftp-item input', fname0)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    const remoteFileList = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList.length).equal(remoteFileListBefore.length + 1)

    // enter folder
    await client.doubleClick('.ssh-wrap-show .file-list.remote .sftp-item.real-file-item .file-bg')
    await delay(5000)
    const pathCurrentRemote = await client.getValue('.ssh-wrap-show .sftp-remote-section .sftp-title input')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    const remoteFileList0 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')

    expect(remoteFileList0.length).equal(1)

    // goto parent
    await client.click('.ssh-wrap-show .sftp-remote-section .anticon-arrow-up')
    await delay(5000)
    const remoteFileList1 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList1.length).equal(remoteFileList.length)

    // del folder
    await client.execute(() => {
      document.querySelectorAll('.ssh-wrap-show .file-list.remote .sftp-item .file-bg')[1].click()
    })
    await delay(200)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .sftp-local-section .sftp-title input').blur()
      document.querySelector('.ssh-wrap-show .sftp-remote-section .sftp-title input').blur()
    })
    await delay(300)
    await client.keys(['Delete'])
    await delay(1000)
    await client.keys(['Enter'])
    await delay(5000)
    const remoteFileList2 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList2.length).equal(remoteFileListBefore.length)
  })
})
