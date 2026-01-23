const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(10000000)
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')
const {
  setupSftpConnection,
  createFile,
  createFolder,
  deleteItem,
  enterFolder,
  navigateToParentFolder,
  verifyFileExists,
  verifyFileTransfersComplete,
  selectAllContextMenu // Added missing import
} = require('./common/common')

describe('file-transfer-local-remote', function () {
  it('should test file and folder transfer including folders with files', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)
    log('018.file-transfer.spec.js: app launched')

    await setupSftpConnection(client)
    log('018.file-transfer.spec.js: sftp connected')

    // Test transfer local->remote and remote->local
    await testFileTransfer(client)
    log('018.file-transfer.spec.js: file transfer tested')

    await electronApp.close().catch(console.log)
    log('018.file-transfer.spec.js: app closed')
  })
})

async function testFileTransfer (client) {
  const timestamp = Date.now()

  // Create main test folders in both local and remote
  const mainFolder = `transfer-test-${timestamp}`

  await createFolder(client, 'local', mainFolder)
  await createFolder(client, 'remote', mainFolder)

  // Enter the test folder in local
  await enterFolder(client, 'local', mainFolder)
  await delay(2000)

  // Create test files in local with specific prefixes for easier identification
  const localFiles = [
    `local-file-1-${timestamp}.txt`,
    `local-file-2-${timestamp}.txt`,
    `local-file-3-${timestamp}.txt`
  ]

  // Create test folders in local
  const localFolders = [
    `local-folder-1-${timestamp}`,
    `local-folder-2-${timestamp}`,
    `local-folder-3-${timestamp}`
  ]

  // Create all test items in local
  for (const fileName of localFiles) {
    await createFile(client, 'local', fileName)
    await delay(800)
  }

  for (const folderName of localFolders) {
    await createFolder(client, 'local', folderName)
    await delay(800)
  }

  // Drag a file into one of the folders in local
  const localSourceElement = await client.locator(`.session-current .file-list.local .sftp-item[title="${localFiles[0]}"]`)
  const localTargetElement = await client.locator(`.session-current .file-list.local .sftp-item[title="${localFolders[0]}"]`)

  // Get bounding boxes for drag operation
  const localSourceBound = await localSourceElement.boundingBox()
  const localTargetBound = await localTargetElement.boundingBox()

  // Perform drag operation
  await client.mouse.move(localSourceBound.x + localSourceBound.width / 2, localSourceBound.y + localSourceBound.height / 2)
  await client.mouse.down()
  await delay(500)
  await client.mouse.move(localTargetBound.x + localTargetBound.width / 2, localTargetBound.y + localTargetBound.height / 2, { steps: 20 })
  await delay(500)
  await client.mouse.up()
  await delay(3000) // Wait for drag-drop operation to complete

  // Enter the test folder in remote
  await enterFolder(client, 'remote', mainFolder)
  await delay(2000)

  // Create test files in remote with specific prefixes
  const remoteFiles = [
    `remote-file-1-${timestamp}.txt`,
    `remote-file-2-${timestamp}.txt`,
    `remote-file-3-${timestamp}.txt`
  ]

  // Create test folders in remote
  const remoteFolders = [
    `remote-folder-1-${timestamp}`,
    `remote-folder-2-${timestamp}`,
    `remote-folder-3-${timestamp}`
  ]

  // Create all test items in remote
  for (const fileName of remoteFiles) {
    await createFile(client, 'remote', fileName)
    await delay(800)
  }

  for (const folderName of remoteFolders) {
    await createFolder(client, 'remote', folderName)
    await delay(800)
  }

  // Drag a file into one of the folders in remote
  const remoteSourceElement = await client.locator(`.session-current .file-list.remote .sftp-item[title="${remoteFiles[0]}"]`)
  const remoteTargetElement = await client.locator(`.session-current .file-list.remote .sftp-item[title="${remoteFolders[0]}"]`)

  // Get bounding boxes for drag operation
  const remoteSourceBound = await remoteSourceElement.boundingBox()
  const remoteTargetBound = await remoteTargetElement.boundingBox()

  // Perform drag operation
  await client.mouse.move(remoteSourceBound.x + remoteSourceBound.width / 2, remoteSourceBound.y + remoteSourceBound.height / 2)
  await client.mouse.down()
  await delay(500)
  await client.mouse.move(remoteTargetBound.x + remoteTargetBound.width / 2, remoteTargetBound.y + remoteTargetBound.height / 2, { steps: 20 })
  await delay(500)
  await client.mouse.up()
  await delay(3000) // Wait for drag-drop operation to complete

  // PART 1: LOCAL TO REMOTE TRANSFER (using context menu select all)

  // Since one file is now in a folder, combine remaining visible items
  const localVisibleItems = [localFiles[1], localFiles[2], ...localFolders]

  // Use context menu to select all visible items in local
  await selectAllContextMenu(client, 'local')
  await delay(1000)

  // Verify we selected the correct number of items
  const selectedLocalItems = await client.locator('.session-current .file-list.local .sftp-item.selected')
  const selectedLocalCount = await selectedLocalItems.count()
  expect(selectedLocalCount).toBe(5) // 2 files + 3 folders

  // Use context menu to upload to remote
  await client.rightClick('.session-current .file-list.local .sftp-item.selected', 10, 10)
  await delay(1000)

  // Click the upload menu item
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item .anticon.anticon-cloud-upload')
  await delay(10000) // Increased delay for folders with files to transfer

  // Verify fileTransfers array is empty after the operation
  await verifyFileTransfersComplete(client)

  // Verify all local items were transferred to remote, including folder structure
  for (const itemName of localVisibleItems) {
    expect(await verifyFileExists(client, 'remote', itemName)).toBe(true)
  }

  // Verify the file inside the transferred folder
  await enterFolder(client, 'remote', localFolders[0])
  await delay(2000)
  expect(await verifyFileExists(client, 'remote', localFiles[0])).toBe(true)
  await navigateToParentFolder(client, 'remote')
  await delay(2000)

  // PART 2: REMOTE TO LOCAL TRANSFER (using ctrl/cmd-select)

  // Since one file is now in a folder, combine remaining visible items
  const remoteVisibleItems = [remoteFiles[1], remoteFiles[2], ...remoteFolders]

  // Use ctrl/cmd-select for remote items
  await client.click(`.session-current .file-list.remote .sftp-item[title="${remoteVisibleItems[0]}"]`)
  await delay(500)

  // Use keyboard modifier to select the rest of the items
  const isMac = process.platform === 'darwin'
  const modifier = isMac ? 'Meta' : 'Control'

  for (let i = 1; i < remoteVisibleItems.length; i++) {
    const itemElement = await client.locator(`.session-current .file-list.remote .sftp-item[title="${remoteVisibleItems[i]}"]`)
    await itemElement.click({ modifiers: [modifier] })
    await delay(500)
  }

  // Verify we selected the correct number of items
  const selectedRemoteItems = await client.locator('.session-current .file-list.remote .sftp-item.selected')
  const selectedRemoteCount = await selectedRemoteItems.count()
  expect(selectedRemoteCount).toBe(5) // 2 files + 3 folders

  // Use context menu to download to local
  await client.rightClick('.session-current .file-list.remote .sftp-item.selected', 10, 10)
  await delay(1000)

  // Click the download menu item
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item .anticon.anticon-cloud-download')
  await delay(10000) // Increased delay for folders with files to transfer

  // Verify fileTransfers array is empty after the operation
  await verifyFileTransfersComplete(client)

  // Verify all remote items were transferred to local, including folder structure
  for (const itemName of remoteVisibleItems) {
    expect(await verifyFileExists(client, 'local', itemName)).toBe(true)
  }

  // Verify the file inside the transferred folder
  await enterFolder(client, 'local', remoteFolders[0])
  await delay(2000)
  expect(await verifyFileExists(client, 'local', remoteFiles[0])).toBe(true)
  await navigateToParentFolder(client, 'local')
  await delay(2000)

  // Navigate back to parent folders
  await navigateToParentFolder(client, 'local')
  await delay(2000)
  await navigateToParentFolder(client, 'remote')
  await delay(2000)

  // Clean up - delete both test folders
  await deleteItem(client, 'local', mainFolder)
  await deleteItem(client, 'remote', mainFolder)
  await delay(2000)
}
