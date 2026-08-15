const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

it('should toggle split view and control tabs correctly', async () => {
  const electronApp = await electron.launch(appOptions)
  const client = await electronApp.firstWindow()
  extendClient(client, electronApp)

  await delay(3500)

  const terminalSection = client.locator('.term-wrap')
  const sftpSection = client.locator('.sftp-section')
  const splitViewToggle = client.locator('.session-current .split-view-toggle')
  const sftpFollowSshIcon = client.locator('.sftp-follow-ssh-icon')

  // Check initial state
  await expect(terminalSection).toBeVisible()
  await expect(sftpSection).toBeHidden()
  await expect(splitViewToggle).toBeVisible()
  await expect(sftpFollowSshIcon).toBeVisible()

  // Click split view toggle
  await splitViewToggle.click()
  await delay(1000)

  // After toggle: both terminal and sftp should be visible
  await expect(terminalSection).toBeVisible()
  await expect(sftpSection).toBeVisible()
  await expect(splitViewToggle).toBeVisible()
  await expect(sftpFollowSshIcon).toBeVisible()

  // Click split view toggle again
  await splitViewToggle.click()
  await delay(1000)

  // After second toggle: should return to initial state
  await expect(terminalSection).toBeVisible()
  await expect(sftpSection).toBeHidden()
  await expect(splitViewToggle).toBeVisible()
  await expect(sftpFollowSshIcon).toBeVisible()

  await electronApp.close().catch(console.log)
})
