const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
// const { getTerminalContent } = require('./common/basic-terminal-test')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')

describe('file-item-context-menu', function () {
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

async function createFolder (client, type, folderName) {
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
  await delay(400)
  await client.setValue('.session-current .sftp-item input', folderName)
  await client.click('.session-current .sftp-title-wrap')
  await delay(2500)
}

async function deleteFolder (client, type, folderName) {
  await client.rightClick(`.session-current .file-list.${type} .real-file-item[title="${folderName}"]`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Delete")')
  await delay(400)
  await client.keyboard.press('Enter')
  await delay(1000)
}

// Then modify your testSelectAll function to use these new utility functions:

async function testSelectAll (client, type) {
  // Create two test folders
  const folderName1 = `test-folder-1-${Date.now()}`
  const folderName2 = `test-folder-2-${Date.now()}`

  await createFolder(client, type, folderName1)
  await createFolder(client, type, folderName2)

  // Right click on any real file item to open context menu
  await client.rightClick(`.session-current .file-list.${type} .real-file-item`, 10, 10)
  await delay(500)

  // Click on "Select All" in the context menu
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Select All")')
  await delay(1000)

  // Check if all real file items have the 'selected' class
  let fileItems = await client.locator(`.session-current .file-list.${type} .real-file-item`)
  let count = await fileItems.count()

  expect(count).toBeGreaterThanOrEqual(2)

  for (let i = 0; i < count; i++) {
    const hasSelectedClass = await fileItems.nth(i).evaluate(el => el.classList.contains('selected'))
    expect(hasSelectedClass).toBe(true)
  }

  // Click on a single file item
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

  // Deselect all for the next test
  await client.click(`.session-current .file-list.${type}`)
  await delay(500)

  // Clean up - delete the test folders
  await deleteFolder(client, type, folderName1)
  await deleteFolder(client, type, folderName2)
}
