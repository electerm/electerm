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
  closeApp
} = require('./common/common')

describe('multi-file-drag-drop-operation', function () {
  it('should test multiple file selection and drag-drop operations', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)
    log('019.file-op-drag-to-folder.spec.js: app launched')

    await setupSftpConnection(client)
    log('019.file-op-drag-to-folder.spec.js: sftp connected')

    // Test for both local and remote
    await testMultiFileDragDrop(client, 'local')
    log('019.file-op-drag-to-folder.spec.js: local drag drop tested')
    await testMultiFileDragDrop(client, 'remote')
    log('019.file-op-drag-to-folder.spec.js: remote drag drop tested')

    log('019.file-op-drag-to-folder.spec.js: calling close')
    await closeApp(electronApp, __filename)
    log('019.file-op-drag-to-folder.spec.js: app closed')
  })
})

/**
 * Select files by clicking the first and shift-clicking the last,
 * then drag them into targetFolderName.
 */
async function dragFilesToFolder (client, type, fileNames, targetFolderName) {
  // Select first file
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${fileNames[0]}"]`)
  await delay(500)

  // Shift-click last file to select all
  const lastFile = client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileNames[fileNames.length - 1]}"]`)
  await lastFile.click({ modifiers: ['Shift'] })
  await delay(1000)

  const sourceBound = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileNames[0]}"]`).boundingBox()
  const targetBound = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${targetFolderName}"]`).boundingBox()

  await client.mouse.move(
    sourceBound.x + sourceBound.width / 2,
    sourceBound.y + sourceBound.height / 2
  )
  await client.mouse.down()
  await delay(500)
  await client.mouse.move(
    targetBound.x + targetBound.width / 2,
    targetBound.y + targetBound.height / 2,
    { steps: 20 }
  )
  await delay(500)
  await client.mouse.up()
  await delay(3000)
}

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

  // --- Drag 1: files → targetFolder (no conflict) ---
  await dragFilesToFolder(client, type, fileNames, targetFolderName)

  // Verify transfers complete
  await verifyFileTransfersComplete(client)

  // Enter target folder to verify files were moved
  await enterFolder(client, type, targetFolderName)
  await delay(2000)

  // Verify all three files exist in the target folder
  for (const fileName of fileNames) {
    expect(await verifyFileExists(client, type, fileName)).toBe(true)
  }

  // --- Drag files back to parent folder using parent-file-item ---
  // Select all three files by clicking first and shift-clicking last
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${fileNames[0]}"]`)
  await delay(500)

  const lastFileElement = client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileNames[2]}"]`)
  await lastFileElement.click({ modifiers: ['Shift'] })
  await delay(1000)

  // Verify all three files are selected
  for (const fileName of fileNames) {
    const item = client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileName}"]`)
    const isSelected = await item.evaluate(el => el.classList.contains('selected'))
    expect(isSelected).toBe(true)
  }

  // Drag from first file to parent-file-item
  const dragSourceBound = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${fileNames[0]}"]`).boundingBox()
  const parentFileBound = await client.locator(`.session-current .file-list.${type} .parent-file-item`).boundingBox()

  await client.mouse.move(
    dragSourceBound.x + dragSourceBound.width / 2,
    dragSourceBound.y + dragSourceBound.height / 2
  )
  await client.mouse.down()
  await delay(500)
  await client.mouse.move(
    parentFileBound.x + parentFileBound.width / 2,
    parentFileBound.y + parentFileBound.height / 2,
    { steps: 20 }
  )
  await delay(500)
  await client.mouse.up()
  await delay(3000)

  // Verify transfers complete
  await verifyFileTransfersComplete(client)

  // Go back to mainFolder and verify files are there
  await navigateToParentFolder(client, type)
  await delay(2000)

  for (const fileName of fileNames) {
    expect(await verifyFileExists(client, type, fileName)).toBe(true)
  }

  // Verify target folder is empty
  await enterFolder(client, type, targetFolderName)
  await delay(2000)

  // The target folder should only have the parent-file-item and hidden-file-item
  const itemCount = await client.locator(`.session-current .file-list.${type} .sftp-item`).count()
  expect(itemCount).toBe(2) // Only parent-file-item and hidden-file-item

  // Go back to mainFolder
  await navigateToParentFolder(client, type)
  await delay(2000)

  // --- Conflict test setup: create same-named files in targetFolder ---
  // Files are now in mainFolder, targetFolder is empty.
  // Populate targetFolder with same file names so subsequent drags produce conflicts.
  await enterFolder(client, type, targetFolderName)
  await delay(1500)

  for (const fileName of fileNames) {
    await createFile(client, type, fileName)
    await delay(500)
  }

  // Navigate back to mainFolder
  await navigateToParentFolder(client, type)
  await delay(1500)

  // --- Drag 2 (conflict): files → targetFolder, resolve with Rename ---
  // mainFolder has 3 files; targetFolder already has the same file names → conflict.
  await dragFilesToFolder(client, type, fileNames, targetFolderName)

  // Handle conflict with rename (reused from 018 pattern)
  await client.click('.custom-modal-footer button:has-text("Rename all")')
  await delay(3000)
  await verifyFileTransfersComplete(client)

  // Enter targetFolder and verify renamed items exist
  await enterFolder(client, type, targetFolderName)
  await delay(1500)

  const renamedItems = client.locator(`.session-current .file-list.${type} .sftp-item[title*="(rename-"]`)
  const renamedCount = await renamedItems.count()
  expect(renamedCount).toBeGreaterThan(0)
  log(`019: Found ${renamedCount} renamed items in ${type} ${targetFolderName}`)

  // Navigate back to mainFolder
  await navigateToParentFolder(client, type)
  await delay(1500)

  // --- Drag 3 (conflict): files → targetFolder, resolve with Overwrite ---
  // After the rename drag, mainFolder files were moved; recreate them.
  for (const fileName of fileNames) {
    await createFile(client, type, fileName)
    await delay(500)
  }

  // targetFolder still has the original-named files → conflict on overwrite.
  await dragFilesToFolder(client, type, fileNames, targetFolderName)

  // Handle conflict with overwrite (reused from 018 pattern)
  await client.click('.custom-modal-footer button:has-text("Overwrite all")')
  await delay(3000)
  await verifyFileTransfersComplete(client)

  // Enter targetFolder and verify original file names still exist (overwritten)
  await enterFolder(client, type, targetFolderName)
  await delay(1500)

  for (const fileName of fileNames) {
    expect(await verifyFileExists(client, type, fileName)).toBe(true)
  }
  log(`019: Overwrite conflict resolution verified in ${type} ${targetFolderName}`)

  // Navigate back to mainFolder
  await navigateToParentFolder(client, type)
  await delay(1500)

  // Go back to parent folder
  await navigateToParentFolder(client, type)
  await delay(2000)

  // Clean up - delete the main test folder (which contains everything)
  await deleteItem(client, type, mainFolderName)
  await delay(2000)
}
