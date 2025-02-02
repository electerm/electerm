const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const log = require('./common/log')
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const nanoid = require('./common/uid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('local file manager', function () {
  it('should open window and basic sftp works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // click sftp tab
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(3500)

    // make a local folder
    let localFileListBefore = await client.elements('.session-current .file-list.local .sftp-item')
    localFileListBefore = await localFileListBefore.count()
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(3300)
    log('009 -> add folder')

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
    let localFileList0 = await client.elements('.session-current .file-list.local .real-file-item')
    localFileList0 = await localFileList0.count()
    expect(localFileList0).equal(0)

    // new file
    await delay(200)
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(1200)
    log('009 -> add file')
    await client.click('.ant-dropdown .anticon-file-add')
    await delay(200)
    const fname00 = '00000test-electerm' + nanoid()
    await client.setValue('.session-current .sftp-item input', fname00)
    await client.doubleClick('.session-current .sftp-title-wrap')
    await delay(2500)
    let localFileList00 = await client.elements('.session-current .file-list.local .real-file-item')
    localFileList00 = await localFileList00.count()
    expect(localFileList00).equal(1)

    // select all and del Control
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(1200)
    log('009 -> select all')
    await client.click('.ant-dropdown .anticon-check-square')
    await delay(120)
    await client.keyboard.press('Delete')
    await delay(120)
    await client.keyboard.press('Enter')
    await delay(4000)
    let localFileList11 = await client.elements('.session-current .file-list.local .real-file-item')
    localFileList11 = await localFileList11.count()
    expect(localFileList11).equal(0)

    // goto parent
    await delay(20)
    log('009 -> goto parent')
    await client.click('.session-current .sftp-local-section .anticon-arrow-up')
    await delay(4000)
    let localFileList1 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList1 = await localFileList1.count()
    expect(localFileList1).equal(localFileList)

    // del folder
    log('009 -> del folder')
    await delay(100)
    await client.click('.session-current .file-list.local .real-file-item')
    await delay(200)

    await client.keyboard.press('Delete')
    await delay(260)
    await client.keyboard.press('Enter')
    await delay(7000)
    let localFileList2 = await client.elements('.session-current .file-list.local .sftp-item')
    localFileList2 = await localFileList2.count()
    expect(localFileList2).equal(localFileListBefore)
    await electronApp.close().catch(console.log)
  })
})
