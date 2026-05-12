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
const {
  closeApp,
  createFile,
  createFolder,
  deleteItem,
  enterFolder,
  navigateToParentFolder,
  selectAllContextMenu,
  setupSftpConnection,
  verifyCurrentPath,
  verifyFileExists,
  verifyFileNotExists
} = require('./common/common')

describe('local file manager', function () {
  it('should open window and basic sftp works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // make a local folder
    await setupSftpConnection(client)
    log('009 -> add folder')
    const fname = '00000test-electerm' + nanoid()
    await createFolder(client, 'local', fname)
    expect(await verifyFileExists(client, 'local', fname)).equal(true)

    // enter folder
    await enterFolder(client, 'local', fname)
    expect(await verifyCurrentPath(client, 'local', fname)).equal(true)

    // new file
    log('009 -> add file')
    const fname00 = '00000test-electerm' + nanoid()
    await createFile(client, 'local', fname00)
    expect(await verifyFileExists(client, 'local', fname00)).equal(true)

    // select all and del Control
    log('009 -> select all')
    await selectAllContextMenu(client, 'local')
    await client.keyboard.press('Delete')
    await delay(420)
    await client.keyboard.press('Enter')
    await delay(4000)
    expect(await verifyFileNotExists(client, 'local', fname00)).equal(true)

    // goto parent
    log('009 -> goto parent')
    await navigateToParentFolder(client, 'local')
    expect(await verifyFileExists(client, 'local', fname)).equal(true)

    // del folder
    log('009 -> del folder')
    await deleteItem(client, 'local', fname)
    expect(await verifyFileNotExists(client, 'local', fname)).equal(true)
    await closeApp(electronApp, __filename)
  })
})
