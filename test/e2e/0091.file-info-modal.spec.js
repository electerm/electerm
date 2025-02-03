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

describe('file info modal', function () {
  it('should open window and basic file info modal works', async function () {
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
    await client.rightClick('.session-current .file-list.local .real-file-item', 10, 10)
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

    // open info modal
    await delay(200)
    await client.rightClick('.session-current .file-list.local .real-file-item', 10, 10)
    await delay(200)
    await client.click('.ant-dropdown .anticon-info-circle')
    await delay(1200)
    await client.hasElem('.ant-modal-wrap')
    await electronApp.close().catch(console.log)
  })
})
