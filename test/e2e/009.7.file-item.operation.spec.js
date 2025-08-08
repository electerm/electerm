const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(10000000)
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')
const {
  setupSftpConnection,
  createFile,
  createFolder,
  deleteItem,
  copyItem,
  pasteItem,
  enterFolder,
  navigateToParentFolder
} = require('./common/common')

describe('file-copy-paste-operation', function () {
  it('should test file copy and paste operations', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    await setupSftpConnection(client)

    // Test for both local and remote
    await testCopyPasteOperation(client, 'local')
    await testCopyPasteOperation(client, 'remote')

    await electronApp.close()
  })
})

async function testCopyPasteOperation (client, type) {
  // Create a main test folder to contain all test operations
  const mainTestFolderName = `test-copy-paste-${Date.now()}`
  await createFolder(client, type, mainTestFolderName)

  // Enter the main test folder
  await enterFolder(client, type, mainTestFolderName)

  // Create a test file
  const fileName = `original-file-${Date.now()}.js`
  await createFile(client, type, fileName)

  // Copy the file
  await copyItem(client, type, fileName)

  // Give more time for the clipboard to update
  await delay(2000)

  // Test 1: Paste in the same directory
  await pasteItem(client, type)

  // Verify that a renamed file was created
  const renamedFiles = await client.locator(`.session-current .file-list.${type} .sftp-item[title*="${fileName.slice(0, -3)}("]`)
  const count = await renamedFiles.count()
  expect(count).toBeGreaterThanOrEqual(1)

  // Verify the renamed file follows the pattern
  const renamedFileName = await renamedFiles.first().getAttribute('title')
  expect(renamedFileName).toMatch(/^original-file-\d+\([\w\d-]+\)\.js$/)

  // Test 2: Create folder, paste into subfolder
  // Create a subfolder
  const subFolderName = `sub-folder-${Date.now()}`
  await createFolder(client, type, subFolderName)

  // Copy the original file again
  await copyItem(client, type, fileName)

  // Give more time for the clipboard to update
  await delay(2000)

  // Enter the subfolder
  await enterFolder(client, type, subFolderName)

  // Paste the file in the subfolder
  await pasteItem(client, type)

  // Give time for the paste to complete
  await delay(2000)

  // Verify the file was created in the subfolder
  const copiedFiles = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileName}"]`)
  const copiedCount = await copiedFiles.count()
  expect(copiedCount).toBe(1)

  // Navigate back to main test folder
  await navigateToParentFolder(client, type)

  // Navigate back to the parent folder (outside the main test folder)
  await navigateToParentFolder(client, type)

  // Clean up - delete the entire main test folder with all its contents
  await deleteItem(client, type, mainTestFolderName)
}
