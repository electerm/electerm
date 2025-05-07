const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(1000000)
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')

const {
  setupSftpConnection,
  createFile,
  createFolder,
  enterFolder,
  navigateToParentFolder,
  deleteItem
} = require('./common/common')

describe('file edit operations', function () {
  it('should properly handle file editing, search functionality and copy button', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Set up SFTP connection
    await setupSftpConnection(client)

    // Test local file editing (using context menu)
    await testFileEdit(client, 'local')

    // Test remote file editing (testing both context menu and double-click)
    await testFileEdit(client, 'remote', true)

    await electronApp.close()
  })
})

async function testFileEdit (client, type, testDoubleClick = false) {
  // Create a parent test folder
  const testFolderName = `edit-test-folder-${Date.now()}`
  await createFolder(client, type, testFolderName)
  await delay(2000)

  // Enter the test folder
  await enterFolder(client, type, testFolderName)
  await delay(2000)

  // Create a test file inside the folder
  const testFileName = `edit-test-file-${Date.now()}.txt`
  await createFile(client, type, testFileName)
  await delay(2000)

  // Test 1: Open editor using context menu
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${testFileName}"]`, 10, 10)
  await delay(1000)

  // Click the "Edit" option from context menu
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Edit")')
  await delay(3000) // Wait for editor modal to open

  // Verify the editor modal is open
  await client.hasElem('.ant-modal .ant-modal-body textarea')

  // Type multiline test content with repeating keywords for search testing
  const testContent = `This is a ${type} test content for the file editor!
Second line of content with keyword.
Third line has another example.
Fourth line with keyword appearing again.
Fifth line is the last example line.
Keyword appears one final time here.`

  await client.setValue('.ant-modal .ant-modal-body textarea', testContent)
  await delay(1000)

  // Test 2: Test search functionality
  // Set a search term that appears multiple times - use the correct input selector
  const searchKeyword = 'keyword'
  await client.setValue('.ant-modal .ant-modal-body .ant-input-search input.ant-input', searchKeyword)
  await delay(500)

  // Press Enter to trigger search
  await client.keyboard.press('Enter')
  await delay(1000)

  // Verify that search found some matches (counter should show "1/3" or similar)
  const searchCounterText = await client.getText('.ant-modal .ant-modal-body .pd1x')
  expect(searchCounterText).not.toBe('0/0')

  // Test next/previous navigation buttons
  // Click "next" button - use a more specific selector
  await client.click('.ant-modal .ant-modal-body button:has(.anticon-arrow-down)')
  await delay(500)

  // Verify the counter incremented (should now be at "2/3" or similar)
  const nextSearchCounterText = await client.getText('.ant-modal .ant-modal-body .pd1x')
  expect(nextSearchCounterText).not.toBe(searchCounterText)

  // Click "previous" button - use a more specific selector
  await client.click('.ant-modal .ant-modal-body button:has(.anticon-arrow-up)')
  await delay(500)

  // Verify counter went back to original value
  const prevSearchCounterText = await client.getText('.ant-modal .ant-modal-body .pd1x')
  expect(prevSearchCounterText).toBe(searchCounterText)

  // Test 3: Test the copy button
  // Clear the clipboard first
  await client.writeClipboard('')
  await delay(500)

  // Click the copy button - use a more specific selector
  await client.click('.ant-modal .ant-modal-body button:has(.anticon-copy)')
  await delay(1000)

  // Read clipboard content and verify it matches our test content
  const clipboardContent = await client.readClipboard()
  expect(clipboardContent).toBe(testContent)

  // Click the save button
  await client.click('.ant-modal .ant-modal-body button:has-text("save")')
  await delay(5000) // Wait for save operation to complete

  // For remote files, also test double-click to open editor
  if (type === 'remote' && testDoubleClick) {
    // Double-click on the file to open editor
    await client.doubleClick(`.session-current .file-list.${type} .sftp-item[title="${testFileName}"]`)
    await delay(3000) // Wait for editor modal to open

    // Verify the editor modal is open
    await client.hasElem('.ant-modal .ant-modal-body textarea')

    // Get the value from the editor to verify it contains our test content
    const editorValue = await client.getValue('.ant-modal .ant-modal-body textarea')
    expect(editorValue).toBe(testContent)

    // Test search with a different keyword
    const altSearchKeyword = 'example'
    await client.setValue('.ant-modal .ant-modal-body .ant-input-search input.ant-input', altSearchKeyword)
    await delay(500)

    // Press Enter to trigger search
    await client.keyboard.press('Enter')
    await delay(1000)

    // Verify that search found matches
    const altSearchCounterText = await client.getText('.ant-modal .ant-modal-body .pd1x')
    expect(altSearchCounterText).not.toBe('0/0')

    // Add more content and save (to verify double-click editing works)
    const additionalContent = '\nAdded through double-click access.'
    await client.setValue('.ant-modal .ant-modal-body textarea', testContent + additionalContent)
    await delay(1000)

    // Save the updated content
    await client.click('.ant-modal .ant-modal-body button:has-text("save")')
    await delay(5000)
  }

  // Final verification: Reopen the file
  await client.rightClick(`.session-current .file-list.${type} .sftp-item[title="${testFileName}"]`, 10, 10)
  await delay(1000)
  await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Edit")')
  await delay(3000)

  // Get the value from the editor to verify the content
  const editorValue = await client.getValue('.ant-modal .ant-modal-body textarea')
  if (type === 'remote' && testDoubleClick) {
    expect(editorValue).toBe(testContent + '\nAdded through double-click access.')
  } else {
    expect(editorValue).toBe(testContent)
  }

  // Close the editor using cancel button
  await client.click('.ant-modal .ant-modal-body button:has-text("cancel")')
  await delay(2000)

  // Navigate back to the parent folder
  await navigateToParentFolder(client, type)
  await delay(2000)

  // Clean up - delete the test folder
  await deleteItem(client, type, testFolderName)
  await delay(2000)
}
