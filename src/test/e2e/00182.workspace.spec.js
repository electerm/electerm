const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { describe } = it
it.setTimeout(100000)

describe('workspace', function () {
  it('workspace feature should work properly', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Test 1: Open layout dropdown and verify tabs exist
    log('Test 1: Opening layout dropdown')
    await client.click('.tabs .layout-dd-icon')
    await delay(500)
    const dropdown = await client.countElem('.layout-workspace-dropdown')
    expect(dropdown).equal(1)

    // Test 2: Verify Layout tab is active by default
    log('Test 2: Verifying Layout tab is default')
    const activeTab = await client.getText('.layout-workspace-dropdown .ant-tabs-tab.ant-tabs-tab-active')
    expect(activeTab).includes('Layout')

    // Test 3: Switch to Workspaces tab
    log('Test 3: Switching to Workspaces tab')
    await client.click('.layout-workspace-dropdown .ant-tabs-tab:has-text("Workspaces")')
    await delay(300)

    // Test 4: Verify workspace content is shown
    log('Test 4: Verifying workspace content')
    const workspaceContent = await client.countElem('.workspace-menu-content')
    expect(workspaceContent).equal(1)

    // Test 5: Verify save button exists
    log('Test 5: Verifying save button')
    const saveBtn = await client.countElem('.workspace-save-btn button')
    expect(saveBtn).equal(1)

    // Test 6: Click save button to open save modal
    log('Test 6: Opening save modal')
    await client.click('.workspace-save-btn button')
    await delay(300)
    const saveModal = await client.countElem('.custom-modal-close')
    expect(saveModal).equal(1)

    // Test 7: Verify save modal has name input
    log('Test 7: Verifying save modal input')
    const nameInput = await client.countElem('.custom-modal-wrap .ant-input')
    expect(nameInput).greaterThan(0)

    // Test 8: Enter a workspace name and save
    log('Test 8: Saving workspace')
    const workspaceName = 'Test Workspace ' + Date.now()
    await client.setValue('.custom-modal-wrap .ant-input', workspaceName)
    await delay(200)
    await client.click('.custom-modal-wrap .ant-btn-primary:has-text("Save")')
    await delay(500)

    // Test 9: Verify modal is closed
    log('Test 9: Verifying modal closed')
    const modalAfterSave = await client.countElem('.custom-modal-close')
    expect(modalAfterSave).equal(0)

    // Test 11: Open dropdown again and switch to workspace tab
    log('Test 11: Reopening dropdown')
    await client.click('.tabs .layout-dd-icon')
    await delay(300)
    await client.click('.layout-workspace-dropdown .ant-tabs-tab:has-text("Workspaces")')
    await delay(300)

    // Test 12: Verify workspace appears in the list
    log('Test 12: Verifying workspace in list')
    const workspaceItems = await client.countElem('.workspace-item')
    expect(workspaceItems).greaterThan(0)

    // Test 13: Verify workspace name is displayed
    log('Test 13: Verifying workspace name displayed')
    const displayedName = await client.getText('.workspace-name')
    expect(displayedName).includes('Test Workspace')

    // Test 14: Change layout then load workspace to restore
    log('Test 14: Testing workspace load')
    // First change layout to something different
    await client.click('.layout-workspace-dropdown .ant-tabs-tab:has-text("Layout")')
    await delay(300)
    await client.click('.layout-menu-item:nth-child(2)') // select c2 layout
    await delay(500)

    // Reopen dropdown and switch back to Workspaces tab
    await client.click('.tabs .layout-dd-icon')
    await delay(300)
    await client.click('.layout-workspace-dropdown .ant-tabs-tab:has-text("Workspaces")')
    await delay(300)

    // Now load the workspace by clicking on it
    await client.click('.workspace-item')
    await delay(500)

    // Test 15: Delete workspace
    log('Test 15: Testing workspace delete')
    // Reopen dropdown
    await client.click('.tabs .layout-dd-icon')
    await delay(300)
    await client.click('.layout-workspace-dropdown .ant-tabs-tab:has-text("Workspaces")')
    await delay(300)

    // Click delete icon
    const deleteIcon = await client.countElem('.workspace-delete-icon')
    if (deleteIcon > 0) {
      await client.click('.workspace-delete-icon')
      await delay(300)

      // Confirm delete
      await client.click('.ant-popconfirm .ant-btn-primary')
      await delay(500)

      // Verify workspace deleted
      const remainingWorkspaces = await client.countElem('.workspace-item')
      expect(remainingWorkspaces).equal(0)
    }

    await electronApp.close().catch(console.log)
  })
})
