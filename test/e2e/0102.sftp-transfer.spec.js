/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('./common/expect')
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

describe('sftp file transfer', function () {
  it('should open window and basic sftp works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5500)
    await client.click('.btns .anticon-plus-circle')
    await delay(6500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await delay(100)
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(1500)
    const tabsCount = await await client.evaluate(() => {
      return window.store.tabs.length
    })
    expect(tabsCount).equal(2)
    await delay(4010)

    // click sftp tab
    log('click sftp tab')
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(2500)

    // make a local folder
    let localFileListBefore = await client.elements('.session-current .file-list.local .sftp-item')
    localFileListBefore = await localFileListBefore.count()
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(3300)
    log('add folder')

    await client.click('.ant-dropdown .anticon-folder-add')
    await delay(200)
    const fname = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)
    let localFileList = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList = await localFileList.count()
    expect(localFileList).equal(localFileListBefore + 1)

    // enter folder
    await client.doubleClick('.session-current .file-list.local .real-file-item .file-bg')
    await delay(5000)
    const pathCurrentLocal = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    let localFileList0 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList0 = await localFileList0.count()
    expect(localFileList0).equal(2)

    // new file
    await delay(200)
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(1200)
    log('add file')
    await client.click('.ant-dropdown .anticon-file-add')
    await delay(200)
    const fname00 = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname00)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(2500)
    let localFileList00 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList00 = await localFileList00.count()
    expect(localFileList00).equal(3)

    // remote test
    // make a remote folder
    let remoteFileListBefore = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileListBefore = await remoteFileListBefore.count()
    await client.rightClick('.session-current .file-list.remote .parent-file-item', 10, 10)
    await delay(1600)
    await client.evaluate(() => {
      document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-folder-add').click()
    })
    await delay(200)
    const fname0 = '00000test-electerm-remote' + nanoid()
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', fname0)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(3500)
    let remoteFileList = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList = await remoteFileList.count()
    expect(remoteFileList).equal(remoteFileListBefore + 1)

    // enter folder
    await client.doubleClick('.session-current .file-list.remote .sftp-item.real-file-item')
    await delay(9000)
    const pathCurrentRemote = await client.getValue('.session-current .sftp-remote-section .sftp-title input')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    let remoteFileList0 = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList0 = await remoteFileList0.count()

    expect(remoteFileList0).equal(2)

    // transfer local to remote
    await delay(200)
    await client.rightClick('.session-current .file-list.local .sftp-item.real-file-item', 3, 3)
    await delay(1200)
    log('do upload')
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-cloud-upload')

    // transfer remote to local
    await delay(500)
    log('del')
    await client.click('.session-current .file-list.local .sftp-item.real-file-item .file-bg')
    await delay(200)

    // select all and del local file
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(1200)
    log('select all')
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-check-square')
    await delay(120)
    await client.keyboard.press('Delete')
    await delay(120)
    await client.keyboard.press('Enter')
    await delay(3000)
    let localFileList11 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList11 = await localFileList11.count()
    expect(localFileList11).equal(2)

    await delay(1800)
    await client.rightClick('.session-current .file-list.remote .sftp-item.real-file-item .file-bg', 10, 10)
    await delay(1123)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-cloud-download')
    await delay(3000)
    const localFileList001 = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList001).equal(3)

    await delay(1000)
    const remoteFileList01 = await client.countElem('.session-current .file-list.remote .sftp-item')
    expect(remoteFileList01).equal(3)

    // goto parent
    await delay(20)
    log('goto parent')
    await client.click('.session-current .sftp-local-section .anticon-arrow-up')
    await delay(2000)
    let localFileList1 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList1 = await localFileList1.count()
    expect(localFileList1).equal(localFileList)

    // del folder
    log('del folder')
    await delay(100)
    await client.click('.session-current .file-list.local .real-file-item')
    await delay(500)

    await client.keyboard.press('Delete')
    await delay(860)
    await client.keyboard.press('Enter')
    await delay(5000)
    let localFileList2 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList2 = await localFileList2.count()
    expect(localFileList2).equal(localFileListBefore)

    // goto parent remote
    await client.click('.session-current .sftp-remote-section .anticon-arrow-up')
    await delay(5000)
    let remoteFileList1 = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList1 = await remoteFileList1.count()
    expect(remoteFileList1).equal(remoteFileList)

    // del folder
    await client.click('.session-current .file-list.remote .real-file-item')
    await delay(200)
    // await client.execute(function () {
    //   document.querySelector('.session-current .sftp-local-section .sftp-title input').blur()
    //   document.querySelector('.session-current .sftp-remote-section .sftp-title input').blur()
    // })
    await delay(300)
    await client.keyboard.press('Delete')
    await delay(1000)
    await client.keyboard.press('Enter')
    await delay(8000)
    let remoteFileList2 = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList2 = await remoteFileList2.count()
    expect(remoteFileList2).equal(remoteFileListBefore)
    await electronApp.close().catch(console.log)
  })
})
