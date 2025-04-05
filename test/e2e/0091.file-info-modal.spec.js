const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
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

    // Test remote file info modal
    await testFileInfoModal(client, 'remote', 'escape')

    await electronApp.close().catch(console.log)
  })
})

async function testFileInfoModal (client, fileType, closeMethod) {
  const fname = `${fileType}-test-electerm-${nanoid()}`

  // Create a new folder
  await client.rightClick(`.session-current .file-list.${fileType} .real-file-item`, 10, 10)
  await delay(500)
  await client.click('.ant-dropdown .anticon-folder-add')
  await delay(200)
  await client.setValue('.session-current .sftp-item input', fname)
  await client.click('.session-current .sftp-title-wrap')
  await delay(2500)

  // Verify folder was created
  await client.hasElem(`.session-current .file-list.${fileType} .sftp-item[title="${fname}"]`)

  // Open info modal
  await client.rightClick(`.session-current .file-list.${fileType} .sftp-item[title="${fname}"]`, 10, 10)
  await delay(200)
  await client.click('.ant-dropdown .anticon-info-circle')
  await delay(1200)

  // Verify modal content and visibility
  await client.hasElem('.ant-modal-wrap')
  await client.hasElem('.ant-modal-content')
  await client.hasElem('.ant-modal .file-props')

  // Close modal using different methods
  if (closeMethod === 'click') {
    await client.click('.ant-modal-close')
  } else {
    await client.keyboard.press('Escape')
  }
  await delay(300)

  // Verify modal is closed
  await client.hasElem('.ant-modal-wrap', false)

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
