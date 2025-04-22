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
  enterFolder,
  navigateToParentFolder,
  verifyFileExists,
  verifyFileTransfersComplete // Add this import
} = require('./common/common')

describe('multi-file-drag-drop-operation', function () {
  it('should test multiple file selection and drag-drop operations', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    await setupSftpConnection(client)

    // Test for both local and remote
    await testMultiFileDragDrop(client, 'local')
    await testMultiFileDragDrop(client, 'remote')

    await electronApp.close()
  })
})

async function testMultiFileDragDrop (client, type) {
  // Create a main test folder first
  const mainFolderName = `main-test-folder-${Date.now()}`
  await createFolder(client, type, mainFolderName)

  // Enter the main test folder
  await enterFolder(client, type, mainFolderName)
  await delay(2000)

  // Create target folder for drag-drop operation
  const targetFolderName = `target-folder-${Date.now()}`
  await createFolder(client, type, targetFolderName)

  // Create 3 test files
  const fileNames = [
    `file-1-${Date.now()}.txt`,
    `file-2-${Date.now()}.txt`,
    `file-3-${Date.now()}.txt`
  ]

  for (const fileName of fileNames) {
    await createFile(client, type, fileName)
    await delay(800)
  }

  // Select first file
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${fileNames[0]}"]`)
  await delay(500)

  // Shift-click third file to select all three
  const thirdFileElement = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileNames[2]}"]`)
  await thirdFileElement.click({
    modifiers: ['Shift']
  })
  await delay(1000)

  // Verify all three files are selected
  for (const fileName of fileNames) {
    const item = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileName}"]`)
    const isSelected = await item.evaluate(el => el.classList.contains('selected'))
    expect(isSelected).toBe(true)
  }

  // Perform drag-drop operation
  const sourceElement = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileNames[0]}"]`)
  const targetElement = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${targetFolderName}"]`)

  // Get bounding boxes for source and target
  const sourceBound = await sourceElement.boundingBox()
  const targetBound = await targetElement.boundingBox()

  // Drag from first file to target folder
  await client.mouse.move(
    sourceBound.x + sourceBound.width / 2,
    sourceBound.y + sourceBound.height / 2
  )
  await client.mouse.down()
  await delay(500)

  await client.mouse.move(
    targetBound.x + targetBound.width / 2,
    targetBound.y + targetBound.height / 2,
    { steps: 20 } // Move in steps for smoother drag
  )
  await delay(500)

  await client.mouse.up()
  await delay(3000) // Wait for drag-drop operation to complete

  // Verify fileTransfers array is empty after the operation
  await verifyFileTransfersComplete(client)

  // Enter target folder to verify files were moved
  await enterFolder(client, type, targetFolderName)
  await delay(2000)

  // Verify all three files exist in the target folder
  for (const fileName of fileNames) {
    expect(await verifyFileExists(client, type, fileName)).toBe(true)
  }

  // Go back to main test folder
  await navigateToParentFolder(client, type)
  await delay(2000)

  // Go back to parent folder
  await navigateToParentFolder(client, type)
  await delay(2000)

  // Clean up - delete the main test folder (which contains everything)
  await deleteItem(client, type, mainFolderName)
  await delay(2000)
}
