const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')
const {
  setupSftpConnection,
  createFolder,
  deleteItem,
  selectAllContextMenu
} = require('./common/common')

describe('File List Context Menu Select All Operation', function () {
  it('should select all items using context menu and verify single click behavior for both local and remote file lists', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Set up SSH connection first for remote testing
    await setupSftpConnection(client)

    // Test for both local and remote
    await testSelectAll(client, 'local')
    await testSelectAll(client, 'remote')

    await electronApp.close()
  })
})

async function testSelectAll (client, type) {
  // Create two test folders
  const folderName1 = `test-folder-1-${Date.now()}`
  const folderName2 = `test-folder-2-${Date.now()}`

  await createFolder(client, type, folderName1)
  await createFolder(client, type, folderName2)

  // Select all items using context menu
  await selectAllContextMenu(client, type)

  // Check if all real file items have the 'selected' class
  let fileItems = await client.locator(`.session-current .file-list.${type} .real-file-item`)
  let count = await fileItems.count()
  expect(count).toBeGreaterThanOrEqual(2)

  for (let i = 0; i < count; i++) {
    const hasSelectedClass = await fileItems.nth(i).evaluate(el => el.classList.contains('selected'))
    expect(hasSelectedClass).toBe(true)
  }

  // Click on a single file item to deselect all except the clicked one
  await client.click(`.session-current .file-list.${type} .real-file-item`)
  await delay(500)

  // Check that only the clicked item has the 'selected' class
  fileItems = await client.locator(`.session-current .file-list.${type} .real-file-item`)
  count = await fileItems.count()
  let selectedCount = 0
  for (let i = 0; i < count; i++) {
    const hasSelectedClass = await fileItems.nth(i).evaluate(el => el.classList.contains('selected'))
    if (hasSelectedClass) {
      selectedCount++
    }
  }
  expect(selectedCount).toBe(1)

  // Deselect all for the next test by clicking on empty space
  await client.click(`.session-current .file-list.${type}`)
  await delay(500)

  // Clean up - delete the test folders
  await deleteItem(client, type, folderName1)
  await deleteItem(client, type, folderName2)
}
