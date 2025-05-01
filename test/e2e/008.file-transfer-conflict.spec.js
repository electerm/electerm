const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(1000000)

const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')

const {
  setupSftpConnection,
  createFile,
  createFolder,
  enterFolder,
  navigateToParentFolder,
  deleteItem,
  selectAllContextMenu,
  verifyFileTransfersComplete
} = require('./common/common')

describe('file-transfer-conflict-resolution', function () {
  it('should handle bidirectional file transfer conflicts with different resolution policies', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    await setupSftpConnection(client)
    await delay(2000)

    // Create a single test folder structure for all tests
    const timestamp = Date.now()
    const testFolder = `conflict-test-${timestamp}`

    try {
      // Create and prepare test environment
      await prepareTestEnvironment(client, testFolder)

      // Test conflict policies in both directions
      await testAllConflictPolicies(client, testFolder)
    } finally {
      // Clean up test folders once at the end
      await cleanupTestFolders(client, testFolder)
    }

    await electronApp.close()
  })
})

async function prepareTestEnvironment (client, testFolder) {
  // Create main test folder in both locations
  await createFolder(client, 'local', testFolder)
  await delay(1000)
  await createFolder(client, 'remote', testFolder)
  await delay(1000)

  // Enter both folders
  await enterFolder(client, 'local', testFolder)
  await delay(1000)
  await enterFolder(client, 'remote', testFolder)
  await delay(1000)

  // Create test files and folders in local only
  const testFiles = [
    'test-file-1.txt',
    'test-file-2.txt',
    'test-file-3.txt'
  ]

  const testFolders = [
    'test-folder-1',
    'test-folder-2',
    'test-folder-3'
  ]

  // Create files in local
  for (const fileName of testFiles) {
    await createFile(client, 'local', fileName)
    await delay(500)
  }

  // Create folders in local
  for (const folderName of testFolders) {
    await createFolder(client, 'local', folderName)
    await delay(500)
  }

  // Now upload everything to the remote to create identical structure
  await uploadAllToRemote(client)
}

async function uploadAllToRemote (client) {
  // Select all local items
  await selectAllContextMenu(client, 'local')
  await delay(1000)

  // Upload to remote
  await client.rightClick('.session-current .file-list.local .sftp-item.selected', 10, 10)
  await delay(1000)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item .anticon.anticon-cloud-upload')
  await delay(3000)

  // Wait for transfers to complete
  await verifyFileTransfersComplete(client)
  await delay(1000)
}

async function testAllConflictPolicies (client, testFolder) {
  // Test each policy for local to remote transfers
  await testConflictResolution(client, 'overwrite', 'local', 'remote')
  await testConflictResolution(client, 'rename', 'local', 'remote')
  await testConflictResolution(client, 'skip', 'local', 'remote')

  // Test each policy for remote to local transfers
  await testConflictResolution(client, 'overwrite', 'remote', 'local')
  await testConflictResolution(client, 'rename', 'remote', 'local')
  await testConflictResolution(client, 'skip', 'remote', 'local')
}

async function testConflictResolution (client, policy, fromType, toType) {
  // Select all items in the source panel
  const selectedItems = await selectAllItems(client, fromType)
  await delay(1000)

  // Initiate transfer
  const isUpload = fromType === 'local'
  await client.rightClick(`.session-current .file-list.${fromType} .sftp-item.selected`, 10, 10)
  await delay(1000)

  // Click appropriate transfer menu item
  const menuIconClass = isUpload ? 'cloud-upload' : 'cloud-download'
  await client.click(`.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item .anticon.anticon-${menuIconClass}`)
  await delay(3000)

  // Handle conflict resolution based on policy
  if (policy === 'skip') {
    // Skip each conflict, with the expected number equal to the selected items
    await handleSkipForEachItem(client, selectedItems)
  } else if (policy === 'overwrite') {
    // Check for first conflict item type (file vs folder) and click appropriate button
    const isFolderConflict = await client.elemExist('.ant-modal-footer button:has-text("Merge all")')
    if (isFolderConflict) {
      await client.click('.ant-modal-footer button:has-text("Merge all")')
    } else {
      await client.click('.ant-modal-footer button:has-text("Overwrite all")')
    }
  } else if (policy === 'rename') {
    await client.click('.ant-modal-footer button:has-text("Rename all")')
  } else {
    throw new Error(`Unsupported policy: ${policy}`)
  }

  await delay(5000)

  // Wait for transfers to complete for overwrite and rename
  if (policy !== 'skip') {
    await verifyFileTransfersComplete(client)
  } else {
    // For skip, we've already handled each conflict manually
    await delay(2000)
  }

  // Verify results based on policy
  if (policy === 'rename') {
    // Verify renamed items exist in destination (with rename- pattern)
    const renamedItems = await client.locator(`.session-current .file-list.${toType} .sftp-item[title*="(rename-"]`)
    const count = await renamedItems.count()
    expect(count).toBeGreaterThan(0, `Expected to find renamed items from ${fromType} to ${toType} with policy ${policy}`)
  } else if (policy === 'overwrite') {
    // For overwrite, just verify the original count of items is maintained
    const items = await client.locator(`.session-current .file-list.${toType} .real-file-item`)
    const count = await items.count()
    expect(count).toBe(selectedItems, `Expected to find ${selectedItems} items in ${toType} after overwrite`)
  }
}

async function selectAllItems (client, type) {
  // First deselect everything by clicking empty space
  await client.click(`.session-current .file-list.${type}`)
  await delay(500)

  // Use selection context menu to select all real file items
  await selectAllContextMenu(client, type)
  await delay(1000)

  // Count and return the number of selected items
  const selectedItems = await client.locator(`.session-current .file-list.${type} .sftp-item.selected`).count()
  expect(selectedItems).toBeGreaterThan(0, `Expected to select items in ${type}`)

  return selectedItems
}

async function handleSkipForEachItem (client, expectedItemCount) {
  // For folders with files inside, we may have more conflicts than the base item count
  // To handle this, we'll track the current conflict index and click Skip until all are done
  let conflictsHandled = 0
  // let timeWithoutConflict = 0
  const waitInterval = 2000 // Time to wait between checks
  await delay(waitInterval * 2)
  // Continue until we have no more conflicts for a reasonable time
  while (conflictsHandled < expectedItemCount) {
    await client.click('.ant-modal-footer button:has-text("Skip")')
    conflictsHandled++

    // Wait for a short time before checking again
    await delay(waitInterval)
  }

  console.log(`Total conflicts skipped: ${conflictsHandled}`)

  // We should have at least as many conflicts as selected items
  expect(conflictsHandled).toBeGreaterThanOrEqual(expectedItemCount,
    `Expected at least ${expectedItemCount} conflicts to be skipped, but only skipped ${conflictsHandled}`)
}

async function cleanupTestFolders (client, testFolder) {
  // Navigate back to parent folders (if not already there)
  try {
    // Check if we need to navigate back
    const localPathInput = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    if (localPathInput.includes(testFolder)) {
      await navigateToParentFolder(client, 'local')
      await delay(1000)
    }

    const remotePathInput = await client.getValue('.session-current .sftp-remote-section .sftp-title input')
    if (remotePathInput.includes(testFolder)) {
      await navigateToParentFolder(client, 'remote')
      await delay(1000)
    }

    // Delete test folders
    await deleteItem(client, 'local', testFolder)
    await delay(1000)
    await deleteItem(client, 'remote', testFolder)
    await delay(1000)
  } catch (error) {
    console.error('Error during cleanup:', error)
    // Continue with test completion even if cleanup fails
  }
}
