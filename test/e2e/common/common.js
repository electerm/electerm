const delay = require('./wait')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./env')
const {
  expect
} = require('./expect')

/**
 * Common file and folder operations for electerm SFTP tests
 */
/**
 * Creates a new file in the specified type of file list (local/remote)
 * Always uses the parent-file-item which is guaranteed to be present
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} fileName - The name of the file to create
 */
async function createFile (client, type, fileName) {
  // Always use the parent-file-item for right-click context menu
  await client.rightClick(`.session-current .file-list.${type} .parent-file-item`, 10, 10)

  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New File")')
  await delay(400)
  await client.setValue('.session-current .sftp-item input', fileName)
  await client.click('.session-current .sftp-panel-title')
  await delay(3500) // Ensure file creation completes
}

/**
 * Creates a new folder in the specified type of file list (local/remote)
 * Always uses the parent-file-item which is guaranteed to be present
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} folderName - The name of the folder to create
 */
async function createFolder (client, type, folderName) {
  // Always use the parent-file-item for right-click context menu
  await client.rightClick(`.session-current .file-list.${type} .parent-file-item`, 10, 10)

  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
  await delay(400)
  await client.setValue('.session-current .sftp-item input', folderName)
  await client.click('.session-current .sftp-panel-title')
  await delay(3500) // Ensure folder creation completes
}
/**
 * Deletes an item (file or folder) from the specified type of file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to delete
 */
async function deleteItem (client, type, itemName) {
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
  await delay(400)
  await client.keyboard.press('Delete')
  await delay(400)
  await client.keyboard.press('Enter')
  await delay(2000)
}

/**
 * Copies an item using the context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to copy
 */
async function copyItem (client, type, itemName) {
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`, 10, 10)
  await delay(1000) // Increased delay for context menu
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Copy")')
  await delay(1500) // Ensure copy operation registers
}

/**
 * Copies an item using keyboard shortcuts
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to copy
 */
async function copyItemWithKeyboard (client, type, itemName) {
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
  await delay(400)

  // Use Meta+C on Mac, Ctrl+C otherwise
  const isMac = process.platform === 'darwin'
  const modKey = isMac ? 'Meta' : 'Control'
  await client.keyboard.press(`${modKey}+c`)
  await delay(1500) // Ensure copy operation registers
}

/**
 * Cuts an item using the context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to cut
 */
async function cutItem (client, type, itemName) {
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`, 10, 10)
  await delay(800)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Cut")')
  await delay(1000)
}

/**
 * Pastes an item using the context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 */
async function pasteItem (client, type) {
  const parentFolderSelector = `.session-current .file-list.${type} .parent-file-item`
  const realFileSelector = `.session-current .file-list.${type} .real-file-item`

  // Click elsewhere to ensure the previous context menu is closed
  await client.click('.session-current .sftp-panel-title')
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

/**
 * Pastes an item using keyboard shortcuts
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 */
async function pasteItemWithKeyboard (client, type) {
  // Click on empty space in the file list to ensure focus
  await client.click(`.session-current .file-list.${type}`)
  await delay(1000)

  // Use Meta+V on Mac, Ctrl+V otherwise
  const isMac = process.platform === 'darwin'
  const modKey = isMac ? 'Meta' : 'Control'
  await client.keyboard.press(`${modKey}+v`)
  await delay(4000) // Increased delay for paste operation
}

/**
 * Renames an item using the context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} oldName - The current name of the item
 * @param {string} newName - The new name for the item
 */
async function renameItem (client, type, oldName, newName) {
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${oldName}"]`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
  await delay(400)
  await client.setValue('.session-current .sftp-item input', newName)
  await client.click('.session-current .sftp-panel-title')
  await delay(2500)
}

/**
 * Enters a folder in the file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} folderName - The name of the folder to enter
 */
async function enterFolder (client, type, folderName) {
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${folderName}"]`, 10, 10)
  await delay(800)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Enter")')
  await delay(3500) // Increased delay for folder navigation
}

/**
 * Navigates to the parent folder
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 */
async function navigateToParentFolder (client, type) {
  await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
  await delay(3000)
}

/**
 * Selects all items in a file list using context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 */
async function selectAllContextMenu (client, type) {
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Select All")')
  await delay(1000)
}

/**
 * Accesses folder from the terminal through context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} folderName - The name of the folder to access
 */
async function accessFolderFromTerminal (client, type, folderName) {
  await client.rightClick(`.file-list.${type} .sftp-item[title="${folderName}"]`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Access this folder from the terminal")')
  await delay(1000)
}

/**
 * Sets up SFTP connection for testing
 *
 * @param {Object} client - The Playwright client
 */
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

/**
 * Verify that a file exists in the file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to verify
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function verifyFileExists (client, type, itemName) {
  const fileItems = await client.locator(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
  const count = await fileItems.count()
  return count > 0
}

// Selection operations
async function selectItemsWithShift (client, type, startIndex, endIndex) {
  const items = await client.locator(`.session-current .file-list.${type} .real-file-item`)

  // Click first item
  await items.nth(startIndex).click()
  await delay(500)

  // Shift+click second item
  await items.nth(endIndex).click({
    modifiers: ['Shift']
  })
  await delay(500)
}

async function selectItemsWithCtrlOrCmd (client, type, indices) {
  const items = await client.locator(`.session-current .file-list.${type} .real-file-item`)

  // Click first item
  await items.nth(indices[0]).click()
  await delay(500)

  // Add remaining items with Cmd/Ctrl
  for (let i = 1; i < indices.length; i++) {
    await items.nth(indices[i]).click({
      modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control']
    })
    await delay(500)
  }
}

/**
 * Verifies the current path in the file list input
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} expectedPath - The expected path or part of it
 * @returns {Promise<boolean>} - Whether the path matches
 */
async function verifyCurrentPath (client, type, expectedPath) {
  const currentPath = await client.getValue(`.session-current .sftp-${type}-section .sftp-title input`)
  return currentPath.endsWith(expectedPath)
}

/**
 * Clicks on the SFTP tab
 *
 * @param {Object} client - The Playwright client
 */
async function clickSftpTab (client) {
  await client.click('.session-current .term-sftp-tabs .type-tab', 1)
  await delay(3500)
}

/**
 * Counts items in the file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} selector - The CSS selector for the items (e.g., '.sftp-item' or '.parent-file-item')
 */
async function countFileListItems (client, type, selector) {
  const items = await client.locator(`.session-current .file-list.${type} ${selector}`)
  return await items.count()
}

/**
 * Verifies the number of selected items
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {number} expectedCount - The expected number of selected items
 */
async function verifySelectionCount (client, type, expectedCount) {
  const selectedItems = await client.locator(`.session-current .file-list.${type} .sftp-item.selected`)
  const count = await selectedItems.count()
  expect(count).toBe(expectedCount, `Expected ${expectedCount} items to be selected, found ${count}`)
}

/**
 * Verifies that the fileTransfers array in window.store is empty
 *
 * @param {Object} client - The Playwright client
 */
async function verifyFileTransfersComplete (client) {
  const isEmpty = await client.evaluate(() => {
    return window.store.fileTransfers.length === 0
  })
  expect(isEmpty).toBe(true, 'Expected fileTransfers array to be empty after operations complete')
}

module.exports = {
  createFile,
  createFolder,
  deleteItem,
  copyItem,
  copyItemWithKeyboard,
  cutItem,
  pasteItem,
  pasteItemWithKeyboard,
  renameItem,
  enterFolder,
  navigateToParentFolder,
  selectAllContextMenu,
  accessFolderFromTerminal,
  setupSftpConnection,
  verifyFileExists,
  selectItemsWithShift,
  selectItemsWithCtrlOrCmd,
  verifyCurrentPath,
  clickSftpTab,
  countFileListItems,
  verifySelectionCount,
  verifyFileTransfersComplete
}
