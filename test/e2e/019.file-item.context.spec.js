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
    await delay(200)
    await client.keyboard.press('Delete')
    await delay(200)
    await client.keyboard.press('Enter')
    await delay(2000)

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

    // Create a new folder in remote
    await client.rightClick('.session-current .file-list.remote .parent-file-item', 10, 10)
    await delay(500)
    const folderName = 'test-ssh-folder-' + Date.now()
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
    await delay(200)
    await client.setValue('.session-current .sftp-remote-section .sftp-item input', folderName)
    await client.click('.session-current .sftp-title-wrap')
    await delay(2500)

    // Verify local folder does not have "Access this folder from terminal" option
    await client.rightClick('.file-list.local .parent-file-item', 10, 10)
    await delay(500)
    const localContextMenu = await client.locator('.ant-dropdown:not(.ant-dropdown-hidden)')
    const localHasTerminalAccess = await localContextMenu.locator('.ant-dropdown-menu-item:has-text("Access this folder from the terminal")').count()
    expect(localHasTerminalAccess).toBe(0)

    // Right click on remote folder and verify it has the terminal access option
    await client.rightClick(`.file-list.remote .sftp-item[title="${folderName}"]`, 10, 10)
    await delay(500)
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Access this folder from the terminal")')
    await delay(1000)

    // Verify terminal has cd command and folder name
    const terminalContent = await getTerminalContent(client)
    expect(terminalContent.includes('cd ')).toBe(true)
    expect(terminalContent.includes(folderName)).toBe(true)

    // Clean up - delete the test folder
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(1000)
    await client.click(`.file-list.remote .sftp-item[title="${folderName}"]`)
    await delay(200)
    await client.keyboard.press('Delete')
    await delay(200)
    await client.keyboard.press('Enter')
    await delay(2000)

    await electronApp.close()
  })
})
