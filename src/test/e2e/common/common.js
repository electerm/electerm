const delay = require('./wait')
const diagnose = require('./diagnose')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER,
  TEST_PORT
} = require('./env')
const {
  expect
} = require('./expect')
const log = require('./log')

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
  // Always use the parent-file-item for right-click context menu.
  // openContextMenu retries the right click until the dropdown is visible,
  // hardening against the race where the contextmenu event is missed
  // during a list re-render.
  await client.withContextMenu(
    `.session-current .file-list.${type} .parent-file-item`,
    '.ant-dropdown-menu-item:has-text("New File")'
  )
  await delay(400)
  await client.setValue('.session-current .sftp-item input', fileName)
  await client.click('.session-current .sftp-panel-title')
  await delay(3500) // Ensure file creation completes
  if (!await verifyFileExists(client, type, fileName, 10000)) {
    throw new Error(`createFile failed: ${type}/${fileName} not listed after creation`)
  }
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
  await delay(500)
  // Always use the parent-file-item for right-click context menu.
  // openContextMenu retries until the dropdown is visible.
  await client.withContextMenu(
    `.session-current .file-list.${type} .parent-file-item`,
    '.ant-dropdown-menu-item:has-text("New Folder")'
  )
  await delay(400)
  await client.setValue('.session-current .sftp-item input', folderName)
  await client.click('.session-current .sftp-panel-title')
  await delay(3500) // Ensure folder creation completes
  if (!await verifyFileExists(client, type, folderName, 10000)) {
    throw new Error(`createFolder failed: ${type}/${folderName} not listed after creation`)
  }
}
/**
 * Deletes an item (file or folder) from the specified type of file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to delete
 */
async function deleteItem (client, type, itemName) {
  await ensureItemVisible(client, type, itemName)
  await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
  await delay(400)
  await client.keyboard.press('Delete')
  await delay(400)
  await client.keyboard.press('Enter')
  await delay(2000)
}

/**
 * Waits until a file-list item exists and scrolls it into view so that
 * subsequent clicks target the right row even in virtualized lists.
 * Throws (after capturing diagnostics) when the item never shows up.
 */
async function ensureItemVisible (client, type, itemName, timeout = 20000) {
  const sel = `.session-current .file-list.${type} .sftp-item[title="${itemName}"]`
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const loc = client.locator(sel).first()
    if (await loc.count() > 0) {
      try {
        // Scroll the row to the top of the list so the context menu that
        // opens on right-click has room below and does not split items
        // into the "…" submenu.
        await loc.evaluate((el) => el.scrollIntoView({ block: 'start' }))
      } catch (e) {
        // ignore scroll errors, fall back to playwright scrolling
      }
      await delay(500)
      try {
        await loc.scrollIntoViewIfNeeded()
        await loc.waitFor({ state: 'visible', timeout: 3000 })
        return
      } catch (e) {
        // Row exists but is not visible yet (virtualized list or re-render);
        // keep polling.
      }
    }
    await delay(1000)
  }
  await diagnose(client, `item-not-visible-${type}-${itemName}`)
  throw new Error(`file list item not visible: ${type}/${itemName}`)
}

/**
 * Copies an item using the context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to copy
 */
async function copyItem (client, type, itemName) {
  await ensureItemVisible(client, type, itemName)
  await client.withContextMenu(
    `.session-current .file-list.${type} .sftp-item[title="${itemName}"]`,
    '.ant-dropdown-menu-item:has-text("Copy")'
  )
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
  await ensureItemVisible(client, type, itemName)
  await client.withContextMenu(
    `.session-current .file-list.${type} .sftp-item[title="${itemName}"]`,
    '.ant-dropdown-menu-item:has-text("Cut")'
  )
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
  const pasteTarget = await client.locator(parentFolderSelector).count() > 0
    ? parentFolderSelector
    : realFileSelector

  // Wait for paste menu to be visible and enabled (may live in the "…" submenu)
  await client.withContextMenu(
    pasteTarget,
    '.ant-dropdown-menu-item:has-text("Paste"):not(.ant-dropdown-menu-item-disabled)'
  )
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
  await ensureItemVisible(client, type, oldName)
  await client.withContextMenu(
    `.session-current .file-list.${type} .sftp-item[title="${oldName}"]`,
    '.ant-dropdown-menu-item:has-text("Rename")'
  )
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
  await ensureItemVisible(client, type, folderName)
  await client.withContextMenu(
    `.session-current .file-list.${type} .sftp-item[title="${folderName}"]`,
    '.ant-dropdown-menu-item:has-text("Enter")'
  )
  await delay(3500) // Increased delay for folder navigation
}

/**
 * Navigates to the parent folder
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 */
async function navigateToParentFolder (client, type, retries = 3) {
  const sel = `.session-current .sftp-${type}-section .sftp-title input`
  const readPath = async () => {
    try {
      return await client.getValue(sel)
    } catch (e) {
      return null
    }
  }
  const before = await readPath()
  for (let i = 0; i < retries; i++) {
    await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
    await delay(3000)
    const after = await readPath()
    if (before === null || after === null || after !== before) {
      return
    }
  }
  await diagnose(client, `nav-parent-stuck-${type}`)
  throw new Error(`navigateToParentFolder failed: ${type} path stuck at ${before}`)
}

/**
 * Selects all items in a file list using context menu
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 */
async function selectAllContextMenu (client, type) {
  // Wait for the list to actually load content; on a slow SFTP roundtrip
  // the list can briefly have no real items right after navigation.
  try {
    await client.locator(`.session-current .file-list.${type} .real-file-item`).first().waitFor({ state: 'visible', timeout: 20000 })
  } catch (e) {
    await diagnose(client, `select-all-empty-${type}`)
    throw e
  }
  // Dismiss any stale dropdown, then open the menu with retries until
  // the dropdown is actually visible.
  await client.click('.session-current .sftp-panel-title')
  await delay(500)
  await client.withContextMenu(
    `.session-current .file-list.${type} .real-file-item`,
    '.ant-dropdown-menu-item:has-text("Select All")'
  )
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
  await ensureItemVisible(client, type, folderName)
  await client.withContextMenu(
    `.session-current .file-list.${type} .sftp-item[title="${folderName}"]`,
    '.ant-dropdown-menu-item:has-text("Access this folder from the terminal")'
  )
  await delay(1000)
}

async function openNewConnectionForm (client) {
  await client.click('.btns .anticon-plus-circle')
  await delay(500)
}

async function confirmSshHostKeyVerificationIfNeeded (client, timeout = 4000) {
  const trustButton = client.locator('.custom-modal-wrap button:has-text("Trust and Save")').first()
  try {
    await trustButton.waitFor({ state: 'visible', timeout })
  } catch {
    return false
  }

  await trustButton.click()
  await delay(500)
  return true
}

/**
 * Sets up SSH connection for testing (fills form and submits, no SFTP tab)
 *
 * @param {Object} client - The Playwright client
 */
async function setupSshConnection (client, options = {}) {
  const {
    host = TEST_HOST,
    username = TEST_USER,
    password = TEST_PASS,
    port = TEST_PORT,
    openForm = true,
    waitAfterConnect = 2000,
    hostKeyModalTimeout = 4000
  } = options

  if (openForm) {
    await openNewConnectionForm(client)
  }

  await client.setValue('#ssh-form_host', host)
  await client.setValue('#ssh-form_username', username)
  await client.setValue('#ssh-form_password', password)
  await client.setValue('#ssh-form_port', port)
  await client.click('.setting-wrap .ant-btn-primary:visible')
  await confirmSshHostKeyVerificationIfNeeded(client, hostKeyModalTimeout)
  await delay(waitAfterConnect)
}

/**
 * Sets up SFTP connection for testing (SSH form + SFTP tab)
 *
 * @param {Object} client - The Playwright client
 */
async function setupSftpConnection (client) {
  await setupSshConnection(client)
  // Click sftp tab
  await client.click('.session-current .term-sftp-tabs .type-tab', 1)
  await delay(2500)
  // Reset both panels to their session homes. The app remembers the last
  // visited SFTP paths per host in the shared profile, so without this a
  // test can start in a read-only folder (e.g. /home or /Users) left behind
  // by an earlier test and every creation silently fails.
  await resetSftpPath(client, 'remote')
  await resetSftpPath(client, 'local')
}

/**
 * Navigates an SFTP panel back to its session home via the address bar home
 * button and waits until the home listing is actually shown.
 * Throws (after capturing diagnostics) when the panel does not land home.
 */
async function resetSftpPath (client, type, timeout = 25000) {
  const section = `.session-current .sftp-${type}-section`
  const pathInputSel = `${section} .sftp-title-wrap input`
  // Marker entries that only exist in the session home folders and are never
  // removed by the test suite (see build/bin/clean-test-server-home.js).
  // The local marker is platform specific: macOS homes have Library, Linux
  // CI homes do not, so fall back to .bashrc there.
  const isLinuxRunner = process.platform === 'linux'
  const marker = type === 'remote'
    ? '.bash_history'
    : (isLinuxRunner ? '.bashrc' : 'Library')
  const markerSel = `.session-current .file-list.${type} .sftp-item[title="${marker}"]`
  const listSel = `.session-current .file-list.${type} .sftp-item`
  const atHome = async () => await client.locator(markerSel).count() > 0
  if (await atHome()) {
    return
  }
  const readPath = async () => {
    try {
      return await client.locator(pathInputSel).first().inputValue()
    } catch {
      return null
    }
  }
  const readCount = async () => {
    try {
      return await client.locator(listSel).count()
    } catch {
      return 0
    }
  }
  await client.locator(`${section} .anticon-home`).first().waitFor({ state: 'visible', timeout: 10000 })
  await client.click(`${section} .anticon-home`)
  const start = Date.now()
  let prevPath = await readPath()
  let stableRounds = 0
  while (Date.now() - start < timeout) {
    await delay(1000)
    if (await atHome()) {
      await delay(2500)
      return
    }
    // Fallback for homes without the marker file (e.g. minimal CI test
    // accounts): the home click navigates to the session home by definition,
    // so once the address bar path settles and the listing is loaded, the
    // navigation has completed and we are home.
    const pathNow = await readPath()
    const count = await readCount()
    if (pathNow && count > 0 && pathNow === prevPath) {
      stableRounds += 1
      if (stableRounds >= 2) {
        log(`resetSftpPath: ${type} settled at ${pathNow} without marker, accepting`)
        await delay(1500)
        return
      }
    } else {
      stableRounds = 0
      prevPath = pathNow
    }
  }
  await diagnose(client, `reset-path-${type}`)
  throw new Error(`resetSftpPath failed: ${type} panel did not land home`)
}

/**
 * Verify that a file exists in the file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to verify
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function verifyFileExists (client, type, itemName, timeout = 15000) {
  const sel = `.session-current .file-list.${type} .sftp-item[title="${itemName}"]`
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const count = await client.locator(sel).count()
    if (count > 0) {
      return true
    }
    await delay(1000)
  }
  await diagnose(client, `verify-missing-${type}-${itemName}`)
  return false
}

/**
 * Verify that a file does not exist in the file list
 *
 * @param {Object} client - The Playwright client
 * @param {string} type - The type of file list ('local' or 'remote')
 * @param {string} itemName - The name of the item to verify
 * @returns {Promise<boolean>} - Whether the file does not exist
 */
async function verifyFileNotExists (client, type, itemName, timeout = 15000) {
  const sel = `.session-current .file-list.${type} .sftp-item[title="${itemName}"]`
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const count = await client.locator(sel).count()
    if (count === 0) {
      return true
    }
    await delay(1000)
  }
  return false
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
async function verifyCurrentPath (client, type, expectedPath, timeout = 15000) {
  const sel = `.session-current .sftp-${type}-section .sftp-title input`
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const currentPath = await client.getValue(sel)
      if (currentPath.endsWith(expectedPath)) {
        return true
      }
    } catch (e) {
      // input may not be rendered yet; keep polling
    }
    await delay(1000)
  }
  return false
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
 * Polls with retries to handle timing variations in transfer completion
 *
 * @param {Object} client - The Playwright client
 * @param {number} [timeout=30000] - Max wait time in ms
 * @param {number} [interval=1000] - Poll interval in ms
 */
async function verifyFileTransfersComplete (client, timeout = 30000, interval = 1000) {
  const start = Date.now()
  let isEmpty = false
  while (Date.now() - start < timeout) {
    isEmpty = await client.evaluate(() => {
      return window.store.fileTransfers.length === 0
    })
    if (isEmpty) {
      break
    }
    await delay(interval)
  }
  expect(isEmpty).toBe(true, `Expected fileTransfers array to be empty after operations complete (waited ${timeout}ms)`)
}

async function closeApp (electronApp, fileName) {
  try {
    await Promise.race([
      electronApp.close(),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('close timeout')), 5000))
    ])
  } catch (e) {
    if (e.message === 'close timeout') {
      log(`${fileName}: close timed out, killing process`)
      electronApp.process().kill()
    } else {
      console.log(e)
    }
  }
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
  setupSshConnection,
  setupSftpConnection,
  resetSftpPath,
  verifyFileExists,
  verifyFileNotExists,
  selectItemsWithShift,
  selectItemsWithCtrlOrCmd,
  verifyCurrentPath,
  clickSftpTab,
  countFileListItems,
  verifySelectionCount,
  verifyFileTransfersComplete,
  closeApp
}
