const delay = require('./wait')

// Check if running on macOS
const isMac = process.platform === 'darwin'

/**
 * Common file operations for SFTP tests
 */
module.exports = {
  isMac,

  /**
   * Setup SSH and SFTP connection
   */
  async setupSftpConnection (client, { TEST_HOST, TEST_USER, TEST_PASS }) {
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
  },

  /**
   * Create a new file
   */
  async createFile (client, type, fileName) {
    await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New File")')
    await delay(400)
    await client.setValue('.session-current .sftp-item input', fileName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(3500) // Increased delay to ensure file creation completes
  },

  /**
   * Create a new folder
   */
  async createFolder (client, type, folderName) {
    await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(400)
    await client.setValue('.session-current .sftp-item input', folderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(3500) // Increased delay to ensure folder creation completes
  },

  /**
   * Delete a file or folder
   */
  async deleteItem (client, type, itemName) {
    await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
    await delay(400)
    await client.keyboard.press('Delete')
    await delay(400)
    await client.keyboard.press('Enter')
    await delay(2000)
  },

  /**
   * Copy item using keyboard shortcut
   */
  async copyItemWithKeyboard (client, type, itemName) {
    await client.click(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`)
    await delay(500)

    // Use appropriate keyboard shortcut based on OS
    if (isMac) {
      await client.keyboard.down('Meta')
      await client.keyboard.press('c')
      await client.keyboard.up('Meta')
    } else {
      await client.keyboard.down('Control')
      await client.keyboard.press('c')
      await client.keyboard.up('Control')
    }

    await delay(1500)
  },

  /**
   * Paste item using keyboard shortcut
   */
  async pasteItemWithKeyboard (client, type) {
    const parentFolderSelector = `.session-current .file-list.${type} .parent-file-item`
    const realFileSelector = `.session-current .file-list.${type} .real-file-item`

    // Click to focus the area
    if (await client.locator(parentFolderSelector).count() > 0) {
      await client.click(parentFolderSelector)
    } else {
      await client.click(realFileSelector)
    }
    await delay(500)

    // Use appropriate keyboard shortcut based on OS
    if (isMac) {
      await client.keyboard.down('Meta')
      await client.keyboard.press('v')
      await client.keyboard.up('Meta')
    } else {
      await client.keyboard.down('Control')
      await client.keyboard.press('v')
      await client.keyboard.up('Control')
    }

    await delay(4000)
  },

  /**
   * Copy item using context menu
   */
  async copyItem (client, type, itemName) {
    await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`, 10, 10)
    await delay(1000) // Increased delay for context menu
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Copy")')
    await delay(1500) // Ensure copy operation registers
  },

  /**
   * Cut item using context menu
   */
  async cutItem (client, type, itemName) {
    await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${itemName}"]`, 10, 10)
    await delay(800)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Cut")')
    await delay(1000)
  },

  /**
   * Paste item using context menu
   */
  async pasteItem (client, type) {
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
  },

  /**
   * Enter a folder
   */
  async enterFolder (client, type, folderName) {
    await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${folderName}"]`, 10, 10)
    await delay(800)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Enter")')
    await delay(3500) // Increased delay for folder navigation
  },

  /**
   * Navigate to parent folder
   */
  async navigateToParentFolder (client, type) {
    await client.doubleClick(`.session-current .file-list.${type} .parent-file-item`)
    await delay(3000)
  },

  /**
   * Rename a file or folder
   */
  async renameItem (client, type, oldName, newName) {
    await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${oldName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
    await delay(400)
    await client.setValue('.session-current .sftp-item input', newName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)
  },

  /**
   * Select all files
   */
  async selectAll (client, type) {
    // Right click to open context menu
    await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
    await delay(500)
    // Click on "Select All" in the context menu
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Select All")')
    await delay(1000)
  }
}
