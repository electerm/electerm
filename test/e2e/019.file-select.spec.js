const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(1000000)
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')

const {
  setupSftpConnection,
  createFolder,
  createFile,
  deleteItem,
  enterFolder,
  navigateToParentFolder,
  selectItemsWithCtrlOrCmd
} = require('./common/common')

describe('multi-file selection operations', function () {
  it('should properly handle single and multi-file selection with modifier keys', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)
    log('019.file-select.spec.js: app launched')

    // Set up SFTP connection
    await setupSftpConnection(client)
    log('019.file-select.spec.js: sftp connected')

    // Test both local and remote file systems
    await testMultiFileSelection(client, 'local')
    log('019.file-select.spec.js: local selection tested')
    await testMultiFileSelection(client, 'remote')
    log('019.file-select.spec.js: remote selection tested')

    await electronApp.close().catch(console.log)
    log('019.file-select.spec.js: app closed')
  })
})

async function testMultiFileSelection (client, type) {
  // Create a parent test folder
  const testFolderName = `selection-test-folder-${Date.now()}`
  await createFolder(client, type, testFolderName)

  // Enter the test folder
  await enterFolder(client, type, testFolderName)
  await delay(2000)

  // Create multiple files and folders for testing selection
  const itemNames = [
    `file-1-${Date.now()}.txt`,
    `file-2-${Date.now()}.txt`,
    `file-3-${Date.now()}.txt`,
    `folder-1-${Date.now()}`,
    `folder-2-${Date.now()}`
  ]

  // Create the test items
  for (let i = 0; i < 3; i++) {
    await createFile(client, type, itemNames[i])
  }

  for (let i = 3; i < 5; i++) {
    await createFolder(client, type, itemNames[i])
  }

  // Test 1: Single click selection
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemNames[0]}"]`)
  await delay(500)

  // Verify only one item is selected
  const fileItems = await client.locator(`.session-current .file-list.${type} .real-file-item`)

  let selectedCount = await countSelectedItems(client, fileItems)
  expect(selectedCount).toBe(1)

  // Verify the correct item is selected
  const firstItemSelected = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${itemNames[0]}"]`)
  const hasSelectedClass = await firstItemSelected.evaluate(el => el.classList.contains('selected'))
  expect(hasSelectedClass).toBe(true)

  // Test 2: Click another item should deselect the first
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemNames[1]}"]`)
  await delay(500)

  // Verify only the second item is selected now
  selectedCount = await countSelectedItems(client, fileItems)
  expect(selectedCount).toBe(1)

  const secondItemSelected = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${itemNames[1]}"]`)
  const secondHasSelectedClass = await secondItemSelected.evaluate(el => el.classList.contains('selected'))
  expect(secondHasSelectedClass).toBe(true)

  // Verify first item is no longer selected
  const firstItemStillSelected = await firstItemSelected.evaluate(el => el.classList.contains('selected'))
  expect(firstItemStillSelected).toBe(false)

  // Test 3: Ctrl/Cmd+click for multi-selection
  // Select items at index 0, 2, and 4 (first file, third file, and second folder)
  await selectItemsWithCtrlOrCmd(client, type, [0, 2, 4])
  await delay(1000)

  // Verify exactly three items are selected
  selectedCount = await countSelectedItems(client, fileItems)
  expect(selectedCount).toBe(3)

  // Verify the specific items are selected
  const itemsToCheck = [itemNames[0], itemNames[2], itemNames[4]]
  for (const itemName of itemsToCheck) {
    const item = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
    const isSelected = await item.evaluate(el => el.classList.contains('selected'))
    expect(isSelected).toBe(true)
  }

  // Test 4: Single click again should deselect all and select only one
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemNames[3]}"]`)
  await delay(500)

  // Verify only one item is selected
  selectedCount = await countSelectedItems(client, fileItems)
  expect(selectedCount).toBe(1)

  // Verify the fourth item (folder-1) is selected
  const fourthItemSelected = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${itemNames[3]}"]`)
  const fourthHasSelectedClass = await fourthItemSelected.evaluate(el => el.classList.contains('selected'))
  expect(fourthHasSelectedClass).toBe(true)

  // Navigate back to parent folder
  await navigateToParentFolder(client, type)
  await delay(1500)

  // Clean up by deleting the test folder
  await deleteItem(client, type, testFolderName)
  await delay(2000)
}

async function countSelectedItems (client, fileItems) {
  const count = await fileItems.count()
  let selectedCount = 0

  for (let i = 0; i < count; i++) {
    const hasSelectedClass = await fileItems.nth(i).evaluate(el => el.classList.contains('selected'))
    if (hasSelectedClass) {
      selectedCount++
    }
  }

  return selectedCount
}
