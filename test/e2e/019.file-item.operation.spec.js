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

// Common file operations
async function createFile (client, type, fileName) {
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New File")')
  await delay(400)
  await client.setValue('.session-current .sftp-item input', fileName)
  await client.click('.session-current .sftp-title-wrap')
  await delay(3500) // Increased delay to ensure file creation completes
}

async function createFolder (client, type, folderName) {
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
  await delay(400)
  await client.setValue('.session-current .sftp-item input', folderName)
  await client.click('.session-current .sftp-title-wrap')
  await delay(3500) // Increased delay to ensure folder creation completes
}

async function deleteItem (client, type, itemName) {
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
  await delay(400)
  await client.keyboard.press('Delete')
  await delay(400)
  await client.keyboard.press('Enter')
  await delay(2000)
}

async function copyItem (client, type, itemName) {
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`, 10, 10)
  await delay(1000) // Increased delay for context menu
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Copy")')
  await delay(1500) // Ensure copy operation registers
}

// async function cutItem (client, type, itemName) {
//   await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`, 10, 10)
//   await delay(800)
//   await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Cut")')
//   await delay(1000)
// }

async function pasteItem (client, type) {
  const parentFolderSelector = `.session-current .file-list.${type} .parent-file-item`
  const realFileSelector = `.session-current .file-list.${type} .real-file-item`

  // Click elsewhere to ensure the previous context menu is closed
  await client.click('.session-current .sftp-title-wrap')
  await delay(1000) // Increased delay

  // Try to right click on the parent file item first (for empty folders)
  if (await client.locator(parentFolderSelector).count() > 0) {
    await client.rightClick(parentFolderSelector, 10, 10)
  } else {
    // Fall back to real file item if parent item doesn't exist
    await client.rightClick(realFileSelector, 10, 10)
  }
  await delay(1000)

  // Wait for paste menu to be visible and enabled
  const pasteMenuItem = await client.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Paste"):not(.ant-dropdown-menu-item-disabled)')
  await pasteMenuItem.waitFor({ state: 'visible', timeout: 5000 })
  await pasteMenuItem.click()
  await delay(4000) // Increased delay for paste operation
}

// async function renameItem (client, type, oldName, newName) {
//   await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${oldName}"]`, 10, 10)
//   await delay(500)
//   await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
//   await delay(400)
//   await client.setValue('.session-current .sftp-item input', newName)
//   await client.click('.session-current .sftp-title-wrap')
//   await delay(2500)
// }

async function enterFolder (client, type, folderName) {
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${folderName}"]`, 10, 10)
  await delay(800)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Enter")')
  await delay(3500) // Increased delay for folder navigation
}

async function navigateToParentFolder (client, type) {
  await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
  await delay(3000)
}

async function setupSftpConnection (client) {
  // Create SSH connection
  await client.click('.btns .anticon-plus-circle')
  await delay(500)
  await client.setValue('#ssh-form_host', TEST_HOST)
  await client.setValue('#ssh-form_username', TEST_USER)
  await client.setValue('#ssh-form_password', TEST_PASS)
  await client.click('.setting-wrap .ant-btn-primary')
  await delay(3500)

  // Click sftp tab
  await client.click('.session-current .term-sftp-tabs .type-tab', 1)
  await delay(3500)
}

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
  // Create a folder
  const folderName = `test-folder-${Date.now()}`
  await createFolder(client, type, folderName)

  // Copy the original file again
  await copyItem(client, type, fileName)

  // Give more time for the clipboard to update
  await delay(2000)

  // Enter the folder
  await enterFolder(client, type, folderName)

  // Paste the file in the subfolder
  await pasteItem(client, type)

  // Give time for the paste to complete
  await delay(2000)

  // Verify the file was created in the subfolder
  const copiedFiles = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileName}"]`)
  const copiedCount = await copiedFiles.count()
  expect(copiedCount).toBe(1)

  // Navigate back to parent folder
  await navigateToParentFolder(client, type)

  // Clean up - delete all test files and folders
  // Delete the renamed file in the root folder
  await deleteItem(client, type, renamedFileName)

  // Delete the original file
  await deleteItem(client, type, fileName)

  // Delete the folder (no need to delete the file inside)
  await deleteItem(client, type, folderName)
}
