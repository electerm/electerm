/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('chai')
const delay = require('./common/wait')
const log = require('./common/log')
const { nanoid } = require('nanoid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('sftp basic', function () {
  it('should open window and basic sftp works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    const bookmarkCountPrev = await client.evaluate(() => {
      return window.store.bookmarks.length
    })
    const historyCountPrev = await client.evaluate(() => {
      return window.store.history.length
    })

    log('check ssh config items')
    const sshConfigCount = await client.evaluate(() => {
      return window.store.sshConfigItems.length
    })
    await delay(500)
    expect(sshConfigCount).equal(0)

    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await delay(100)
    await client.click('.setting-wrap .ant-tabs-tabpane-active .ant-btn-primary')
    await delay(2500)
    const tabsCount = await await client.evaluate(() => {
      return window.store.tabs.length
    })
    expect(tabsCount).equal(2)
    await delay(4010)

    // click sftp tab
    log('click sftp tab')
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(2500)

    // bookmark side panel works
    const bookmarkCount = await client.evaluate(() => {
      return window.store.bookmarks.length
    })
    expect(bookmarkCount).equal(bookmarkCountPrev + 1)

    // bookmark side panel works
    await delay(4500)
    const historyCount = await client.evaluate(() => {
      return window.store.history.length
    })
    expect(historyCount).equal(historyCountPrev + 1)

    // make a local folder
    const localFileListBefore = await client.countElem('.session-current .file-list.local .sftp-item')
    await client.rightClick('.session-current .file-list.local .real-file-item .file-bg', 10, 10)
    await delay(3300)
    log('add folder')

    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)
    const localFileList = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList).equal(localFileListBefore + 1)

    // enter folder
    await client.doubleClick('.session-current .file-list.local .sftp-item:not(.virtual-file-unit) .file-bg')
    await delay(5500)
    const pathCurrentLocal = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    expect(pathCurrentLocal.includes(fname)).equal(true)
    const localFileList0 = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList0).equal(1)

    // new file
    await delay(200)
    await client.rightClick('.session-current .file-list.local .sftp-item', 10, 10)
    await delay(200)
    log('add file')
    await client.click('.context-menu .anticon-file-add')
    await delay(200)
    const fname00 = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname00)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(2500)
    const localFileList00 = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList00).equal(2)

    // select all and del local file
    await delay(1000)
    await client.rightClick('.session-current .file-list.local .real-file-item .file-bg', 10, 10)
    await delay(200)
    log('select all')
    await client.click('.context-menu .anticon-check-square')
    await delay(120)
    await client.keyboard.press('Delete')
    await delay(120)
    await client.keyboard.press('Enter')
    await delay(3000)
    let localFileList11 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList11 = await localFileList11.count()
    expect(localFileList11).equal(1)

    // goto parent
    await delay(20)
    log('goto parent')
    await client.click('.session-current .sftp-local-section .anticon-arrow-up')
    await delay(2000)
    const localFileList1 = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList1).equal(localFileList)

    // del folder
    log('del folder')
    await delay(100)
    await client.click('.session-current .file-list.local .real-file-item')
    await delay(900)

    await client.keyboard.press('Delete')
    await delay(1160)
    await client.keyboard.press('Enter')
    await delay(5000)
    const localFileList2 = await client.countElem('.session-current .file-list.local .sftp-item')
    expect(localFileList2).equal(localFileListBefore)

    // remote test
    // make a remote folder
    const remoteFileListBefore = await client.countElem('.session-current .file-list.remote .sftp-item')
    await client.rightClick('.session-current .file-list.remote .real-file-item .file-bg', 10, 10)
    await delay(200)
    await client.click('.context-menu .anticon-folder-add')
    await delay(200)
    const fname0 = '00000test-electerm-remote' + nanoid()
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', fname0)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(3500)
    const remoteFileList = await client.countElem('.session-current .file-list.remote .sftp-item')
    expect(remoteFileList).equal(remoteFileListBefore + 1)

    // enter folder
    await client.doubleClick('.session-current .file-list.remote .sftp-item.real-file-item')
    await delay(9000)
    const pathCurrentRemote = await client.getValue('.session-current .sftp-remote-section .sftp-title input')
    expect(pathCurrentRemote.includes(fname0)).equal(true)
    let remoteFileList0 = await client.elements('.session-current .file-list.remote .sftp-item')
    remoteFileList0 = await remoteFileList0.count()

    expect(remoteFileList0).equal(1)

    // goto parent
    await client.click('.session-current .sftp-remote-section .anticon-arrow-up')
    await delay(5000)
    const remoteFileList1 = await client.countElem('.session-current .file-list.remote .sftp-item')
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
    const remoteFileList2 = await client.countElem('.session-current .file-list.remote .sftp-item')
    expect(remoteFileList2).equal(remoteFileListBefore)
    await electronApp.close().catch(console.log)
  })
})
