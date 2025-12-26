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
    const activeTab = await client.evaluate(() => {
      const tabs = document.querySelectorAll('.layout-workspace-dropdown .ant-tabs-tab')
      for (const tab of tabs) {
        if (tab.classList.contains('ant-tabs-tab-active')) {
          return tab.textContent
        }
      }
      return ''
    })
    expect(activeTab).include('Layout')

    // Test 3: Switch to Workspaces tab
    log('Test 3: Switching to Workspaces tab')
    await client.evaluate(() => {
      const tabs = document.querySelectorAll('.layout-workspace-dropdown .ant-tabs-tab')
      for (const tab of tabs) {
        if (tab.textContent.includes('Workspaces')) {
          tab.click()
          break
        }
      }
    })
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
    const saveModal = await client.countElem('.ant-modal')
    expect(saveModal).equal(1)

    // Test 7: Verify save modal has name input
    log('Test 7: Verifying save modal input')
    const nameInput = await client.countElem('.ant-modal input')
    expect(nameInput).greaterThan(0)

    // Test 8: Enter a workspace name and save
    log('Test 8: Saving workspace')
    const workspaceName = 'Test Workspace ' + Date.now()
    await client.setValue('.ant-modal input', workspaceName)
    await delay(200)
    await client.evaluate(() => {
      const btns = document.querySelectorAll('.ant-modal .ant-btn-primary')
      for (const btn of btns) {
        if (btn.textContent.includes('Save')) {
          btn.click()
          break
        }
      }
    })
    await delay(500)

    // Test 9: Verify modal is closed
    log('Test 9: Verifying modal closed')
    const modalAfterSave = await client.countElem('.ant-modal')
    expect(modalAfterSave).equal(0)

    // Test 10: Verify workspace was saved in store
    log('Test 10: Verifying workspace saved in store')
    const workspaceCount = await client.evaluate(() => {
      return window.store.workspaces.length
    })
    expect(workspaceCount).greaterThan(0)

    // Test 11: Open dropdown again and switch to workspace tab
    log('Test 11: Reopening dropdown')
    await client.click('.tabs .layout-dd-icon')
    await delay(300)
    await client.evaluate(() => {
      const tabs = document.querySelectorAll('.layout-workspace-dropdown .ant-tabs-tab')
      for (const tab of tabs) {
        if (tab.textContent.includes('Workspaces')) {
          tab.click()
          break
        }
      }
    })
    await delay(300)

    // Test 12: Verify workspace appears in the list
    log('Test 12: Verifying workspace in list')
    const workspaceItems = await client.countElem('.workspace-item')
    expect(workspaceItems).greaterThan(0)

    // Test 13: Verify workspace name is displayed
    log('Test 13: Verifying workspace name displayed')
    const displayedName = await client.evaluate((name) => {
      const items = document.querySelectorAll('.workspace-name')
      for (const item of items) {
        if (item.textContent.includes('Test Workspace')) {
          return item.textContent
        }
      }
      return ''
    }, workspaceName)
    expect(displayedName).include('Test Workspace')

    // Test 14: Change layout then load workspace to restore
    log('Test 14: Testing workspace load')
    // First change layout to something different
    await client.evaluate(() => {
      window.store.setLayout('c2')
    })
    await delay(300)

    // Now load the workspace
    await client.evaluate(() => {
      const workspaces = window.store.workspaces
      if (workspaces.length > 0) {
        window.store.loadWorkspace(workspaces[0].id)
      }
    })
    await delay(500)

    // Test 15: Delete workspace
    log('Test 15: Testing workspace delete')
    // Reopen dropdown
    await client.click('.tabs .layout-dd-icon')
    await delay(300)
    await client.evaluate(() => {
      const tabs = document.querySelectorAll('.layout-workspace-dropdown .ant-tabs-tab')
      for (const tab of tabs) {
        if (tab.textContent.includes('Workspaces')) {
          tab.click()
          break
        }
      }
    })
    await delay(300)

    // Click delete icon
    const deleteIcon = await client.countElem('.workspace-delete-icon')
    if (deleteIcon > 0) {
      await client.click('.workspace-delete-icon')
      await delay(300)

      // Confirm delete
      await client.evaluate(() => {
        const okBtn = document.querySelector('.ant-popconfirm .ant-btn-primary')
        if (okBtn) {
          okBtn.click()
        }
      })
      await delay(500)

      // Verify workspace deleted
      const remainingWorkspaces = await client.evaluate(() => {
        return window.store.workspaces.filter(w => w.name.includes('Test Workspace')).length
      })
      expect(remainingWorkspaces).equal(0)
    }

    log('Test 16: Verifying store methods exist')
    const methodsExist = await client.evaluate(() => {
      const store = window.store
      return {
        getCurrentWorkspaceState: typeof store.getCurrentWorkspaceState === 'function',
        saveWorkspace: typeof store.saveWorkspace === 'function',
        loadWorkspace: typeof store.loadWorkspace === 'function',
        deleteWorkspace: typeof store.deleteWorkspace === 'function'
      }
    })
    expect(methodsExist.getCurrentWorkspaceState).equal(true)
    expect(methodsExist.saveWorkspace).equal(true)
    expect(methodsExist.loadWorkspace).equal(true)
    expect(methodsExist.deleteWorkspace).equal(true)

    await electronApp.close().catch(console.log)
  })
})
