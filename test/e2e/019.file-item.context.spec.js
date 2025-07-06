const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const { getTerminalContent } = require('./common/basic-terminal-test')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')

const {
  setupSftpConnection,
  createFolder,
  deleteItem,
  accessFolderFromTerminal,
  renameItem,
  enterFolder,
  navigateToParentFolder,
  verifyFileExists,
  verifyCurrentPath,
  clickSftpTab,
  countFileListItems
} = require('./common/common')

describe('file-item-context-menu', function () {
  it('should test gotoFolderInTerminal function', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Click sftp tab first
    await clickSftpTab(client)

    // Create a new folder
    const folderName = 'test-folder-' + Date.now()
    await createFolder(client, 'local', folderName)

    // Access folder from terminal
    await accessFolderFromTerminal(client, 'local', folderName)

    // Verify terminal has cd command and folder name
    const terminalContent = await getTerminalContent(client)
    expect(terminalContent.includes('cd ')).toBe(true)
    expect(terminalContent.includes(folderName)).toBe(true)

    // Clean up - delete the test folder
    await clickSftpTab(client)
    await deleteItem(client, 'local', folderName)

    await electronApp.close()
  })

  it('should test gotoFolderInTerminal function in SSH session', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Set up SSH connection
    await setupSftpConnection(client)

    // Create a new folder in local first
    const localFolderName = 'test-local-folder-' + Date.now()
    await createFolder(client, 'local', localFolderName)

    // Create a new folder in remote
    const remoteFolderName = 'test-ssh-folder-' + Date.now()
    await createFolder(client, 'remote', remoteFolderName)

    // Verify local folder does not have "Access this folder from terminal" option
    await client.rightClick(`.file-list.local .sftp-item[title="${localFolderName}"]`, 10, 10)
    await delay(500)
    const localContextMenu = await client.locator('.ant-dropdown:not(.ant-dropdown-hidden)')
    const localHasTerminalAccess = await localContextMenu.locator('.ant-dropdown-menu-item:has-text("Access this folder from the terminal")').count()
    expect(localHasTerminalAccess).toBe(0)
    // Close context menu
    await client.click('.session-current .sftp-title-wrap')
    await delay(500)

    // Access remote folder from terminal
    await accessFolderFromTerminal(client, 'remote', remoteFolderName)

    // Verify terminal has cd command and folder name
    const terminalContent = await getTerminalContent(client)
    expect(terminalContent.includes('cd ')).toBe(true)
    expect(terminalContent.includes(remoteFolderName)).toBe(true)

    // Clean up - delete both test folders
    await clickSftpTab(client)
    await deleteItem(client, 'local', localFolderName)
    await deleteItem(client, 'remote', remoteFolderName)

    await electronApp.close()
  })

  it('should test rename function for folders in context menu for both local and remote', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Set up SSH connection
    await setupSftpConnection(client)

    // Test local folder rename
    const localFolderName = 'test-local-rename-folder-' + Date.now()
    await createFolder(client, 'local', localFolderName)

    const newLocalFolderName = 'renamed-' + localFolderName
    await renameItem(client, 'local', localFolderName, newLocalFolderName)

    expect(await verifyFileExists(client, 'local', newLocalFolderName)).toBe(true)

    // Test remote folder rename
    const remoteFolderName = 'test-remote-rename-folder-' + Date.now()
    await createFolder(client, 'remote', remoteFolderName)

    const newRemoteFolderName = 'renamed-' + remoteFolderName
    await renameItem(client, 'remote', remoteFolderName, newRemoteFolderName)

    expect(await verifyFileExists(client, 'remote', newRemoteFolderName)).toBe(true)

    // Clean up - delete the test folders
    await deleteItem(client, 'local', newLocalFolderName)
    await deleteItem(client, 'remote', newRemoteFolderName)

    await electronApp.close()
  })

  it('should test enter folder context menu and verify folder content for both remote and local', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Set up SSH connection
    await setupSftpConnection(client)

    // Test remote file system
    const remoteFolderName = 'test-remote-enter-folder-' + Date.now()
    await createFolder(client, 'remote', remoteFolderName)

    // Enter remote folder
    await enterFolder(client, 'remote', remoteFolderName)

    // Verify remote folder content
    expect(await verifyCurrentPath(client, 'remote', remoteFolderName)).toBe(true)
    expect(await countFileListItems(client, 'remote', '.sftp-item')).toBe(2)
    expect(await countFileListItems(client, 'remote', '.parent-file-item')).toBe(1)

    // Go back to remote parent directory
    await navigateToParentFolder(client, 'remote')
    expect(await verifyCurrentPath(client, 'remote', remoteFolderName)).toBe(false)

    // Test local file system
    const localFolderName = 'test-local-enter-folder-' + Date.now()
    await createFolder(client, 'local', localFolderName)

    // Enter local folder
    await enterFolder(client, 'local', localFolderName)

    // Verify local folder content
    expect(await verifyCurrentPath(client, 'local', localFolderName)).toBe(true)
    expect(await countFileListItems(client, 'local', '.sftp-item')).toBe(2)
    expect(await countFileListItems(client, 'local', '.parent-file-item')).toBe(1)

    // Go back to local parent directory
    await navigateToParentFolder(client, 'local')
    expect(await verifyCurrentPath(client, 'local', localFolderName)).toBe(false)

    // Clean up - delete the test folders
    await deleteItem(client, 'remote', remoteFolderName)
    await deleteItem(client, 'local', localFolderName)

    await electronApp.close()
  })
})
