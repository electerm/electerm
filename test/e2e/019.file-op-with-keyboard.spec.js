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
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
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

    await setupSftpConnection(client, { TEST_HOST, TEST_USER, TEST_PASS })

    // Test for both local and remote
    await testCopyPasteOperationWithKeyboard(client, 'local')
    await testCopyPasteOperationWithKeyboard(client, 'remote')

    await electronApp.close()
  })
})

async function testCopyPasteOperationWithKeyboard (client, type) {
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
  const folderName = `keyboard-test-folder-${Date.now()}`
  await createFolder(client, type, folderName)

  // Enter the folder
  await enterFolder(client, type, folderName)

  // Paste the file in the subfolder using keyboard shortcut
  await pasteItem(client, type)

  // Give time for the paste to complete
  await delay(2000)

  // Verify the file was created in the subfolder
  const copiedFiles = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileName}"]`)
  const copiedCount = await copiedFiles.count()
  expect(copiedCount).toBe(1)

  // Navigate back to parent folder
  await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
  await delay(3000)

  // Clean up - delete all test files and folders
  await deleteItem(client, type, renamedFileName)
  await deleteItem(client, type, fileName)
  await deleteItem(client, type, folderName)
}
