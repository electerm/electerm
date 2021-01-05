/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { Application } = require('spectron')
const { expect } = require('chai')
const delay = require('./common/wait')
const generate = require('./common/uid')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const isOs = require('./common/is-os')

if (!process.env.LOCAL_TEST && isOs('darwin')) {
  return
}

describe('sftp file transfer', function () {
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
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await delay(100)
    await client.execute(function () {
      document.querySelector('.setting-wrap .ant-tabs-tabpane-active .ant-btn-primary').click()
    })
    await delay(500)
    const tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.length).equal(2)
    await delay(2010)

    // click sftp tab
    log('click sftp tab')
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .term-sftp-tabs .type-tab')[1].click()
    })
    await delay(2500)

    // make a local folder
    const localFileListBefore = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-local .virtual-file-unit', 10, 10)
    await delay(3300)
    log('add folder')
    await client.execute(function () {
      document.querySelector('.context-menu .anticon-folder-add').click()
    })
    await delay(300)
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
    await delay(3000)
    const pathCurrentLocal = await client.getValue('.ssh-wrap-show .sftp-local-section .sftp-title input')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    const localFileList0 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList0.length).equal(1)

    // new file
    await client.rightClick('.ssh-wrap-show .virtual-file-local .virtual-file-unit', 10, 10)
    await delay(200)
    log('add file')
    await client.execute(function () {
      document.querySelector('.context-menu .anticon-file-add').click()
    })
    await delay(200)
    const fname00 = '00000test-electerm' + generate()
    await client.setValue('.ssh-wrap-show .sftp-item input', fname00)
    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(2500)
    const localFileList00 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList00.length).equal(2)

    // remote test
    // make a remote folder
    const remoteFileListBefore = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-remote', 10, 10)
    await delay(200)
    log('add folder2')
    await client.execute(function () {
      document.querySelector('.context-menu .anticon-folder-add').click()
    })
    await delay(200)
    const fname0 = '00000test-electerm-remote' + generate()
    await client.setValue('.ssh-wrap-show .sftp-remote-section .sftp-item input', fname0)

    await client.doubleClick('.ssh-wrap-show .sftp-title-wrap')
    await delay(3500)
    const remoteFileList = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList.length).equal(remoteFileListBefore.length + 1)

    // enter folder
    await client.doubleClick('.ssh-wrap-show .file-list.remote .sftp-item.real-file-item .file-bg')
    await delay(5000)
    const pathCurrentRemote = await client.getValue('.ssh-wrap-show .sftp-remote-section .sftp-title input')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    const remoteFileList0 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList0.length).equal(1)

    // transfer local to remote
    await delay(200)
    await client.rightClick('.ssh-wrap-show .file-list.local .sftp-item.real-file-item .file-bg', 3, 3)
    await delay(200)
    log('do upload')
    await client.click('.context-menu .anticon-cloud-upload')

    // transfer remote to local
    await delay(500)
    log('del')
    await client.click('.ssh-wrap-show .file-list.local .sftp-item.real-file-item .file-bg')
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(1800)
    await client.rightClick('.ssh-wrap-show .file-list.remote .sftp-item.real-file-item .file-bg', 10, 10)
    await delay(1123)
    await client.click('.context-menu .anticon-cloud-download')
    await delay(3000)
    const localFileList001 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList001.length).equal(2)

    await delay(1000)
    const remoteFileList01 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList01.length).equal(2)

    // goto parent
    log('goto parent1')
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .sftp-local-section .anticon-arrow-up').click()
    })
    await delay(100)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .sftp-remote-section .anticon-arrow-up').click()
    })
    await delay(3000)
    // del folder
    log('del all')
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item')[1].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])

    await delay(500)
    log('del all2')
    await client.execute(() => {
      document.querySelectorAll('.ssh-wrap-show .file-list.remote .sftp-item .file-bg')[1].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
  })
})
