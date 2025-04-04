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
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')

describe('file-item-context-menu', function () {
  it('should test gotoFolderInTerminal function', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Click sftp tab first
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(3500)

    // Create a new folder
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(500)
    const folderName = 'test-folder-' + Date.now()
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-item input', folderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    // Right click on the folder and select "Access this folder from the terminal"
    await client.rightClick(`.file-list.local .sftp-item[title="${folderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Access this folder from the terminal")')
    await delay(1000)

    // Verify terminal has cd command and folder name
    const terminalContent = await getTerminalContent(client)
    expect(terminalContent.includes('cd ')).toBe(true)
    expect(terminalContent.includes(folderName)).toBe(true)

    // Clean up - delete the test folder
    await client.click('.session-current .term-sftp-tabs .type-tab', 1) // Switch back to file manager
    await delay(1000)
    await client.click(`.file-list.local .sftp-item[title="${folderName}"]`)
    await delay(400)
    await client.keyboard.press('Delete')
    await delay(400)
    await client.keyboard.press('Enter')
    await delay(4000)

    await electronApp.close()
  })

  it('should test gotoFolderInTerminal function in SSH session', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

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

    // Create a new folder in local first
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(500)
    const localFolderName = 'test-local-folder-' + Date.now()
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-item input', localFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    // Create a new folder in remote
    await client.rightClick('.session-current .file-list.remote .parent-file-item', 10, 10)
    await delay(500)
    const remoteFolderName = 'test-ssh-folder-' + Date.now()
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', remoteFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    // Verify local folder does not have "Access this folder from terminal" option
    await client.rightClick(`.file-list.local .sftp-item[title="${localFolderName}"]`, 10, 10)
    await delay(500)
    const localContextMenu = await client.locator('.ant-dropdown:not(.ant-dropdown-hidden)')
    const localHasTerminalAccess = await localContextMenu.locator('.ant-dropdown-menu-item:has-text("Access this folder from the terminal")').count()
    expect(localHasTerminalAccess).toBe(0)

    // Right click on remote folder and verify it has the terminal access option
    await client.rightClick(`.file-list.remote .sftp-item[title="${remoteFolderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Access this folder from the terminal")')
    await delay(1000)

    // Verify terminal has cd command and folder name
    const terminalContent = await getTerminalContent(client)
    expect(terminalContent.includes('cd ')).toBe(true)
    expect(terminalContent.includes(remoteFolderName)).toBe(true)

    // Clean up - delete both test folders
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(1000)

    // Delete local folder
    await client.click(`.file-list.local .sftp-item[title="${localFolderName}"]`)
    await delay(400)
    await client.keyboard.press('Delete')
    await delay(400)
    await client.keyboard.press('Enter')
    await delay(4000)

    // Delete remote folder
    await client.click(`.file-list.remote .sftp-item[title="${remoteFolderName}"]`)
    await delay(400)
    await client.keyboard.press('Delete')
    await delay(400)
    await client.keyboard.press('Enter')
    await delay(4000)

    await electronApp.close()
  })

  it('should test rename function for folders in context menu for both local and remote', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

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

    // Test local folder rename
    const localFolderName = 'test-local-rename-folder-' + Date.now()
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-item input', localFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    await client.rightClick(`.file-list.local .sftp-item[title="${localFolderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
    await delay(1000)

    const newLocalFolderName = 'renamed-' + localFolderName
    await client.setValue('.session-current .sftp-item input', newLocalFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    const renamedLocalFolder = await client.locator(`.file-list.local .sftp-item[title="${newLocalFolderName}"]`)
    expect(await renamedLocalFolder.count()).toBe(1)

    // Test remote folder rename
    const remoteFolderName = 'test-remote-rename-folder-' + Date.now()
    await client.rightClick('.session-current .file-list.remote .parent-file-item', 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', remoteFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    await client.rightClick(`.file-list.remote .sftp-item[title="${remoteFolderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Rename")')
    await delay(1000)

    const newRemoteFolderName = 'renamed-' + remoteFolderName
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', newRemoteFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    const renamedRemoteFolder = await client.locator(`.file-list.remote .sftp-item[title="${newRemoteFolderName}"]`)
    expect(await renamedRemoteFolder.count()).toBe(1)

    // Clean up - delete the test folders
    await client.click(`.file-list.local .sftp-item[title="${newLocalFolderName}"]`)
    await delay(200)
    await client.keyboard.press('Delete')
    await delay(200)
    await client.keyboard.press('Enter')
    await delay(2000)

    await client.click(`.file-list.remote .sftp-item[title="${newRemoteFolderName}"]`)
    await delay(200)
    await client.keyboard.press('Delete')
    await delay(200)
    await client.keyboard.press('Enter')
    await delay(2000)

    await electronApp.close()
  })

  it('should test enter folder context menu and verify folder content for both remote and local', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

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

    // Test remote file system
    const remoteFolderName = 'test-remote-enter-folder-' + Date.now()
    await client.rightClick('.session-current .file-list.remote .parent-file-item', 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', remoteFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    // Enter remote folder
    await client.rightClick(`.file-list.remote .sftp-item[title="${remoteFolderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Enter")')
    await delay(2000)

    // Verify remote folder content
    const remoteCurrentPath = await client.getValue('.session-current .sftp-remote-section .sftp-title input')
    expect(remoteCurrentPath.endsWith(remoteFolderName)).toBe(true)

    const remoteItems = await client.locator('.session-current .file-list.remote .sftp-item')
    const remoteItemCount = await remoteItems.count()
    expect(remoteItemCount).toBe(2)

    const remoteParentItem = await client.locator('.session-current .file-list.remote .parent-file-item')
    const remoteParentItemCount = await remoteParentItem.count()
    expect(remoteParentItemCount).toBe(1)

    // Go back to remote parent directory
    await client.doubleClick('.session-current .file-list.remote .parent-file-item')
    await delay(2000)

    const remoteParentPath = await client.getValue('.session-current .sftp-remote-section .sftp-title input')
    expect(remoteParentPath.endsWith(remoteFolderName)).toBe(false)

    // Test local file system
    const localFolderName = 'test-local-enter-folder-' + Date.now()
    await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-local-section .sftp-item input', localFolderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    // Enter local folder
    await client.rightClick(`.file-list.local .sftp-item[title="${localFolderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Enter")')
    await delay(2000)

    // Verify local folder content
    const localCurrentPath = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    expect(localCurrentPath.endsWith(localFolderName)).toBe(true)

    const localItems = await client.locator('.session-current .file-list.local .sftp-item')
    const localItemCount = await localItems.count()
    expect(localItemCount).toBe(2)

    const localParentItem = await client.locator('.session-current .file-list.local .parent-file-item')
    const localParentItemCount = await localParentItem.count()
    expect(localParentItemCount).toBe(1)

    // Go back to local parent directory
    await client.doubleClick('.session-current .file-list.local .parent-file-item')
    await delay(2000)

    const localParentPath = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    expect(localParentPath.endsWith(localFolderName)).toBe(false)

    // Clean up - delete the test folders
    await client.click(`.file-list.remote .sftp-item[title="${remoteFolderName}"]`)
    await delay(400)
    await client.keyboard.press('Delete')
    await delay(400)
    await client.keyboard.press('Enter')
    await delay(2000)

    await client.click(`.file-list.local .sftp-item[title="${localFolderName}"]`)
    await delay(400)
    await client.keyboard.press('Delete')
    await delay(400)
    await client.keyboard.press('Enter')
    await delay(2000)

    await electronApp.close()
  })

  it('should test selectAll context menu function for both local and remote', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

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

    // Test local file list
    await testSelectAll(client, 'local')

    // Test remote file list
    await testSelectAll(client, 'remote')

    await electronApp.close()
  })
})

async function testSelectAll (client, type) {
  // Create a test folder
  const folderName = `test-folder-${Date.now()}`
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
  await delay(200)
  await client.setValue('.session-current .sftp-item input', folderName)
  await client.click('.session-current .sftp-title-wrap')
  await delay(2500)

  // Right click on any real file item to open context menu
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)

  // Click on "Select All" in the context menu
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Select All")')
  await delay(1000)

  // Check if all real file items have the 'selected' class
  const fileItems = await client.locator(`.session-current .file-list.${type} .real-file-item`)
  const count = await fileItems.count()

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const hasSelectedClass = await fileItems.nth(i).evaluate(el => el.classList.contains('selected'))
      expect(hasSelectedClass).toBe(true)
    }
  } else {
    console.log(`No real file items found in ${type} file list`)
  }

  // Deselect all for the next test
  await client.click(`.session-current .file-list.${type}`)
  await delay(500)

  // Clean up - delete the test folder
  await client.rightClick(`.session-current .file-list.${type} .real-file-item[title="${folderName}"]`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Delete")')
  await delay(200)
  await client.keyboard.press('Enter')
  await delay(1000)
}
