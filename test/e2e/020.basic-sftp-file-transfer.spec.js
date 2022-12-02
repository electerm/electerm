/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('chai')
const delay = require('./common/wait')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const log = require('./common/log')
const { nanoid } = require('nanoid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const basicTermTest = require('./common/basic-terminal-test')

describe('sftp file transfer', function () {
  it('should open window and basic sftp works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await delay(100)
    await client.click('.setting-wrap .ant-tabs-tabpane-active .ant-btn-primary')
    await delay(5500)
    const tabsCount = await await client.evaluate(() => {
      return window.store.tabs.length
    })
    expect(tabsCount).equal(2)
    await delay(4010)
    const cmd = 'rm -rf 000*'
    await basicTermTest(client, cmd)

    // click sftp tab
    log('010 -> click sftp tab')
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(2500)

    // make a local folder
    let localFileListBefore = await client.elements('.session-current .file-list.local .sftp-item')
    localFileListBefore = await localFileListBefore.count()
    await client.rightClick('.session-current .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg', 10, 10)
    await delay(3300)
    log('010 -> add folder')

    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)
    let localFileList = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList = await localFileList.count()
    expect(localFileList).equal(localFileListBefore + 1)

    // enter folder
    await client.doubleClick('.session-current .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg')
    await delay(14000)
    const pathCurrentLocal = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    let localFileList0 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList0 = await localFileList0.count()
    expect(localFileList0).equal(1)

    // new file
    await delay(200)
    await client.rightClick('.session-current .file-list.local .sftp-item', 10, 10)
    await delay(200)
    log('010 -> add file')
    await client.click('.context-menu .anticon-file-add')
    await delay(200)
    const fname00 = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname00)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(2500)
    let localFileList00 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList00 = await localFileList00.count()
    expect(localFileList00).equal(2)

    // remote test
    // make a remote folder
    let remoteFileListBefore = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileListBefore = await remoteFileListBefore.count()
    await client.rightClick('.session-current .file-list.remote .sftp-item:not(.virtual-file-unit) .file-bg', 10, 10)
    await delay(200)
    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname0 = '00000test-electerm-remote' + nanoid()
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', fname0)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(4500)
    let remoteFileList = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList = await remoteFileList.count()
    expect(remoteFileList).equal(remoteFileListBefore + 1)

    // enter folder
    await client.doubleClick('.session-current .file-list.remote .sftp-item:not(.virtual-file-unit) .file-bg')
    await delay(14000)
    const pathCurrentRemote = await client.getValue('.session-current .sftp-remote-section .sftp-title input')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    let remoteFileList0 = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList0 = await remoteFileList0.count()

    expect(remoteFileList0).equal(1)

    // transfer local to remote
    await delay(200)
    await client.rightClick('.session-current .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg', 3, 3)
    await delay(1200)
    log('010 -> do upload')
    await client.click('.context-menu .anticon-cloud-upload')

    // transfer remote to local
    await delay(14500)
    log('010 -> del')
    await client.click('.session-current .file-list.local .sftp-item.real-file-item .file-bg')
    await delay(1200)

    // select all and del local file
    await client.rightClick('.session-current .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg', 10, 10)
    await delay(200)
    log('010 -> select all')
    await client.click('.context-menu .anticon-check-square')
    await delay(2120)
    await client.keyboard.press('Delete')
    await delay(2120)
    await client.keyboard.press('Enter')
    await delay(12000)
    let localFileList11 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList11 = await localFileList11.count()
    expect(localFileList11).equal(1)

    await delay(1800)
    await client.rightClick('.session-current .file-list.remote .sftp-item:not(.virtual-file-unit) .file-bg', 10, 10)
    await delay(2123)
    await client.click('.context-menu .anticon-cloud-download')
    await delay(15000)
    const localFileList001 = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList001).equal(2)

    await delay(1000)
    const remoteFileList01 = await client.countElem('.session-current .file-list.remote .sftp-item')
    expect(remoteFileList01).equal(2)

    // goto parent
    await delay(20)
    log('010 -> goto parent')
    await client.click('.session-current .sftp-local-section .anticon-arrow-up')
    await delay(14000)
    let localFileList1 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList1 = await localFileList1.count()
    expect(localFileList1).equal(localFileList)

    // del folder
    log('010 -> del folder')
    await delay(2100)
    await client.click('.session-current .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg')

    await delay(2200)
    log('010 -> press del')
    await client.keyboard.press('Delete')
    await delay(2060)
    await client.keyboard.press('Enter')
    await delay(13000)
    let localFileList2 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList2 = await localFileList2.count()
    expect(localFileList2).equal(localFileListBefore)

    // goto parent remote
    log('010 -> goto parent remote')
    await client.click('.session-current .sftp-remote-section .anticon-arrow-up')
    await delay(13000)
    log('010 -> goto parent remote1')
    let remoteFileList1 = await client.elements('.session-current .file-list.remote .sftp-item')
    log('010 -> goto parent remote2')
    remoteFileList1 = await remoteFileList1.count()
    expect(remoteFileList1).equal(remoteFileList)

    // del folder
    log('010 -> del folder')
    await client.click('.session-current .file-list.remote .sftp-item:not(.virtual-file-unit) .file-bg')
    await delay(1200)
    // await client.execute(function () {
    //   document.querySelector('.session-current .sftp-local-section .sftp-title input').blur()
    //   document.querySelector('.session-current .sftp-remote-section .sftp-title input').blur()
    // })
    await delay(300)
    await client.keyboard.press('Delete')
    await delay(2000)
    await client.keyboard.press('Enter')
    await delay(8000)
    let remoteFileList2 = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList2 = await remoteFileList2.count()
    expect(remoteFileList2).equal(remoteFileListBefore)
    await electronApp.close().catch(console.log)
  })
})
