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

    // Setup test structure in local only, then transfer to remote
    const timestamp = Date.now()
    const mainFolder = `conflict-test-${timestamp}`

    // Create and prepare test structure efficiently
    await createTestStructureEfficiently(client, mainFolder)

    // Test different conflict resolution policies in both directions
    await testConflictResolution(client, 'skip', 'local', 'remote')
    await testConflictResolution(client, 'overwrite', 'remote', 'local')
    await testConflictResolution(client, 'rename', 'local', 'remote')

    // Clean up - delete the test folder from both locations
    await navigateToParentFolder(client, 'local')
    await delay(2000)
    await navigateToParentFolder(client, 'remote')
    await delay(2000)

    await deleteItem(client, 'local', mainFolder)
    await delay(2000)
    await deleteItem(client, 'remote', mainFolder)
    await delay(2000)

    await electronApp.close()
  })
})

async function createTestStructureEfficiently (client, mainFolder) {
  // Create main folder in local only
  await createFolder(client, 'local', mainFolder)
  await delay(2000)
  await enterFolder(client, 'local', mainFolder)
  await delay(2000)

  // Create test files and folders only in local
  const testFiles = [
    'file-1.txt',
    'file-2.txt',
    'file-3.txt'
  ]

  const testFolders = [
    'folder-1',
    'folder-2',
    'folder-3'
  ]

  // Create items in local
  for (const fileName of testFiles) {
    await createFile(client, 'local', fileName)
    await delay(800)
  }

  for (const folderName of testFolders) {
    await createFolder(client, 'local', folderName)
    await delay(800)
  }

  // Create main folder in remote
  await createFolder(client, 'remote', mainFolder)
  await delay(2000)
  await enterFolder(client, 'remote', mainFolder)
  await delay(2000)

  // First transfer everything from local to remote without conflicts
  // to set up identical environments
  await selectAllContextMenu(client, 'local')
  await delay(1000)

  // Upload to remote
  await client.rightClick('.session-current .file-list.local .sftp-item.selected', 10, 10)
  await delay(1000)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item .anticon.anticon-cloud-upload')
  await delay(5000)

  // Wait for initial setup transfer to complete
  await verifyFileTransfersComplete(client)
  await delay(2000)
}

// In testConflictResolution function, update the skip case:
async function testConflictResolution (client, policy, fromType, toType) {
  // Select all items in source
  await selectAllContextMenu(client, fromType)
  await delay(2000)

  // Initiate transfer
  await client.rightClick(`.session-current .file-list.${fromType} .sftp-item.selected`, 10, 10)
  await delay(2000)

  // Click appropriate transfer menu item
  const menuIconClass = fromType === 'local' ? 'cloud-upload' : 'cloud-download'
  await client.click(`.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item .anticon.anticon-${menuIconClass}`)
  await delay(5000)

  // We know we have 6 items (3 files + 3 folders) that will all have conflicts
  const expectedConflicts = 6

  // Handle conflict resolution based on policy
  if (policy === 'skip') {
    // Click skip for each expected conflict
    for (let i = 0; i < expectedConflicts; i++) {
      // Wait for the modal to be visible
      await client.locator('.ant-modal-footer button:has-text("Skip")').waitFor({
        state: 'visible',
        timeout: 5000
      })

      // Click skip
      await client.click('.ant-modal-footer button:has-text("Skip")')

      // Wait for the modal to disappear and next one to appear (or transfers to complete)
      await delay(1500)
    }
  } else if (policy === 'overwrite') {
    // Try merge all first (for folders), if not found, use overwrite all (for files)
    const mergeAllButton = await client.locator('.ant-modal-footer button:has-text("Merge all")')
    const overwriteAllButton = await client.locator('.ant-modal-footer button:has-text("Overwrite all")')

    if (await mergeAllButton.count() > 0) {
      await mergeAllButton.click()
    } else {
      await overwriteAllButton.click()
    }
  } else if (policy === 'rename') {
    await client.click('.ant-modal-footer button:has-text("Rename all")')
  } else {
    throw new Error(`Unsupported policy: ${policy}`)
  }

  // For all policies, wait for transfers to complete
  await delay(5000)

  // Final verification that transfers are complete
  await verifyFileTransfersComplete(client)
  await delay(2000)

  // Verify results based on policy
  if (policy === 'rename') {
    // Verify renamed items exist in destination
    const renamedItems = await client.locator(`.session-current .file-list.${toType} .sftp-item[title*="(rename-"]`)
    const count = await renamedItems.count()
    expect(count).toBeGreaterThan(0, `Expected to find renamed items from ${fromType} to ${toType} with policy ${policy}`)
  } else if (policy === 'overwrite') {
    // Check all original items still exist in destination (were overwritten)
    const testFiles = ['file-1.txt', 'file-2.txt', 'file-3.txt']
    const testFolders = ['folder-1', 'folder-2', 'folder-3']

    for (const item of [...testFiles, ...testFolders]) {
      const itemExists = await client.locator(`.session-current .file-list.${toType} .sftp-item[title="${item}"]`).count() > 0
      expect(itemExists).toBe(true, `Expected ${item} to exist in ${toType} after overwrite`)
    }
  }
}
