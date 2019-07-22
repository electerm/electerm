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

    await client.waitUntilWindowLoaded()
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
    await delay(500)
    const tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.value.length).equal(2)
    await delay(2010)

    // click sftp tab
    log('click sftp tab')
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .term-sftp-tabs .type-tab')[1].click()
    })
    await delay(2500)

    // make a local folder
    const localFileListBefore = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
    await delay(300)
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
    expect(localFileList.value.length).equal(localFileListBefore.value.length + 1)

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
    const pathCurrentLocal = await client.getAttribute('.ssh-wrap-show .sftp-local-section .sftp-title input', 'value')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    const localFileList0 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList0.value.length).equal(1)

    // new file
    await client.rightClick('.ssh-wrap-show .virtual-file-local', 10, 10)
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
    expect(localFileList00.value.length).equal(2)

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
    await delay(2500)
    const remoteFileList = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList.value.length).equal(remoteFileListBefore.value.length + 1)

    // enter folder
    await client.execute(function () {
      const event = new MouseEvent('dblclick', {
        view: window,
        bubbles: true,
        cancelable: true
      })
      document.querySelectorAll('.ssh-wrap-show .file-list.remote .sftp-item')[1].dispatchEvent(event)
    })
    await delay(2000)
    const pathCurrentRemote = await client.getAttribute('.ssh-wrap-show .sftp-remote-section .sftp-title input', 'value')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    const remoteFileList0 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList0.value.length).equal(1)

    // transfer local to remote
    await delay(200)
    await client.rightClick('.ssh-wrap-show .sftp-item.local', 20, 22)
    await delay(200)
    log('do upload')
    await client.execute(function () {
      document.querySelector('.context-menu .anticon-cloud-upload-o').click()
    })

    // transfer remote to local
    await delay(500)
    log('del')
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .file-list.local .sftp-item .sftp-file-prop')[0].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
    await delay(1800)
    await client.rightClick('.ssh-wrap-show .file-list.remote .sftp-item .sftp-file-prop', 10, 10)
    await delay(323)
    await client.execute(function () {
      document.querySelector('.context-menu .anticon-cloud-download-o').click()
    })

    await delay(2000)
    const localFileList001 = await client.elements('.ssh-wrap-show .file-list.local .sftp-item')
    expect(localFileList001.value.length).equal(2)

    await delay(1000)
    const remoteFileList01 = await client.elements('.ssh-wrap-show .file-list.remote .sftp-item')
    expect(remoteFileList01.value.length).equal(2)

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
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .file-list.remote .sftp-item .sftp-file-prop')[0].click()
    })
    await delay(20)

    await client.keys(['Delete'])
    await delay(20)
    await client.keys(['Enter'])
  })
})
