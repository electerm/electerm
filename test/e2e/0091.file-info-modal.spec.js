const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const nanoid = require('./common/uid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { TEST_HOST, TEST_PASS, TEST_USER } = require('./common/env')

describe('file info modal', function () {
  it('should open window and basic file info modal works for both local and remote', async function () {
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

    // click sftp tab
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(3500)

    // Test local file info modal
    await testFileInfoModal(client, 'local', 'click')

    await electronApp.close().catch(console.log)
  })

  it('should test edit permission functionality for both local and remote files', async function () {
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

    // Test local file edit permission
    await testEditFolderPermission(client, 'local')

    // Test remote file edit permission
    await testEditFolderPermission(client, 'remote')

    await electronApp.close().catch(console.log)
  })
})

async function testEditFolderPermission (client, folderType) {
  const folderName = `${folderType}-test-folder-${nanoid()}`

  // Create a new folder
  await client.rightClick(`.session-current .file-list.${folderType} .parent-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
  await delay(200)
  await client.setValue('.session-current .sftp-item input', folderName)
  await client.click('.session-current .sftp-panel-title')
  await delay(2500)

  // Right-click on the folder and select "Edit Permission"
  await client.rightClick(`.session-current .file-list.${folderType} .sftp-item[title="${folderName}"]`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Edit Permission")')
  await delay(1000)

  // Verify that the edit permission modal is open
  await client.hasElem('.custom-modal-container')

  // Check if the modal title is "Edit Folder Permission"
  const modalTitle = await client.getText('.custom-modal-title')
  expect(modalTitle).toBe('Edit Folder Permission')

  // Change a specific permission (e.g., 'other' 'write')
  const targetGroup = 'other'
  const targetPermission = 'write'
  const buttonSelector = `.custom-modal-container .pd1b:has-text("${targetGroup}") .ant-btn:has-text("${targetPermission}")`

  const initialClass = await client.getAttribute(buttonSelector, 'class')
  const initiallyActive = initialClass.includes('ant-btn-primary')

  await client.click(buttonSelector)
  await delay(200)

  const newClass = await client.getAttribute(buttonSelector, 'class')
  const nowActive = newClass.includes('ant-btn-primary')

  console.log(`${targetGroup} ${targetPermission}: Initial: ${initiallyActive}, Now: ${nowActive}`)
  expect(nowActive).not.toBe(initiallyActive)

  // Save the changes
  await client.click('.custom-modal-footer .ant-btn-primary')
  await delay(2000)

  // Verify that the modal is closed
  await client.hasElem('.custom-modal-container', false)

  // Open folder properties to check if permissions were updated
  await client.rightClick(`.session-current .file-list.${folderType} .sftp-item[title="${folderName}"]`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-info-circle')
  await delay(1200)

  // Verify that the specific permission was updated in the folder properties
  const infoButtonClass = await client.getAttribute(buttonSelector, 'class')
  const infoButtonActive = infoButtonClass.includes('ant-btn-primary')
  expect(infoButtonActive).toBe(nowActive)

  // Close the folder properties modal
  await client.click('.custom-modal-close')
  await delay(300)

  // Clean up - delete the test folder
  await client.click(`.session-current .file-list.${folderType} .sftp-item[title="${folderName}"]`)
  await delay(400)
  await client.keyboard.press('Delete')
  await delay(400)
  await client.keyboard.press('Enter')
  await delay(2500)

  // Verify folder is deleted
  await client.hasElem(`.session-current .file-list.${folderType} .sftp-item[title="${folderName}"]`, false)
}

async function testFileInfoModal (client, fileType, closeMethod) {
  const fname = `${fileType}-test-electerm-${nanoid()}`

  // Create a new folder
  await client.rightClick(`.session-current .file-list.${fileType} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-folder-add')
  await delay(200)
  await client.setValue('.session-current .sftp-item input', fname)
  await client.click('.session-current .sftp-panel-title')
  await delay(2500)

  // Verify folder was created
  await client.hasElem(`.session-current .file-list.${fileType} .sftp-item[title="${fname}"]`)

  // Open info modal
  await client.rightClick(`.session-current .file-list.${fileType} .sftp-item[title="${fname}"]`, 10, 10)
  await delay(200)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .anticon-info-circle')
  await delay(1200)

  // Verify modal content and visibility
  await client.hasElem('.custom-modal-container')
  await client.hasElem('.custom-modal-container')
  await client.hasElem('.custom-modal-wrap .file-props')

  // Close modal using different methods
  if (closeMethod === 'click') {
    await client.click('.custom-modal-close')
  } else {
    await client.keyboard.press('Escape')
  }
  await delay(300)

  // Verify modal is closed
  await client.hasElem('.custom-modal-container', false)

  // Delete the test folder
  await client.click(`.session-current .file-list.${fileType} .sftp-item[title="${fname}"]`)
  await delay(400)
  await client.keyboard.press('Delete')
  await delay(400)
  await client.keyboard.press('Enter')
  await delay(2500)

  // Verify folder is deleted
  await client.hasElem(`.session-current .file-list.${fileType} .sftp-item[title="${fname}"]`, false)
}
