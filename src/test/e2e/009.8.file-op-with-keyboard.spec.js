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
  enterFolder,
  copyItem,
  pasteItem,
  deleteItem
} = require('./common/common')

describe('file-copy-paste-operation-keyboard', function () {
  it('should test file copy and paste operations using keyboard shortcuts', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    await setupSftpConnection(client)

    // Test for both local and remote
    await testCopyPasteOperationWithKeyboard(client, 'local')
    await testCopyPasteOperationWithKeyboard(client, 'remote')

    await electronApp.close()
  })
})

async function testCopyPasteOperationWithKeyboard (client, type) {
  // Create a main test folder to contain all test operations
  const mainTestFolderName = `test-keyboard-copy-paste-${Date.now()}`
  await createFolder(client, type, mainTestFolderName)

  // Enter the main test folder
  await enterFolder(client, type, mainTestFolderName)

  // Create a test file
  const fileName = `keyboard-copy-file-${Date.now()}.js`
  await createFile(client, type, fileName)

  // Copy the file using keyboard shortcut - only need to copy once
  await copyItem(client, type, fileName)

  // Give time for the clipboard to update
  await delay(2000)

  // Test 1: Paste in the same directory using keyboard shortcut
  await pasteItem(client, type)

  // Verify that a renamed file was created
  const renamedFiles = await client.locator(`.session-current .file-list.${type} .sftp-item[title*="${fileName.slice(0, -3)}("]`)
  const count = await renamedFiles.count()
  expect(count).toBeGreaterThanOrEqual(1)

  // Verify the renamed file follows the pattern
  const renamedFileName = await renamedFiles.first().getAttribute('title')
  expect(renamedFileName).toMatch(/^keyboard-copy-file-\d+\([\w\d-]+\)\.js$/)

  // Test 2: Create folder, paste into subfolder using keyboard shortcuts
  const subFolderName = `keyboard-sub-folder-${Date.now()}`
  await createFolder(client, type, subFolderName)

  // Enter the subfolder
  await enterFolder(client, type, subFolderName)

  // Paste the file in the subfolder using keyboard shortcut
  await pasteItem(client, type)

  // Give time for the paste to complete
  await delay(2000)

  // Verify the file was created in the subfolder
  const copiedFiles = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileName}"]`)
  const copiedCount = await copiedFiles.count()
  expect(copiedCount).toBe(1)

  // Navigate back to main test folder
  await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
  await delay(3000)

  // Navigate back to the parent folder (outside the main test folder)
  await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
  await delay(3000)

  // Clean up - delete the entire main test folder with all its contents
  await deleteItem(client, type, mainTestFolderName)
}
