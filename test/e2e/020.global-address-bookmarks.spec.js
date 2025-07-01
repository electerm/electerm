const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const { nanoid } = require('nanoid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('Global Address Bookmarks', function () {
  it('should support global remote address bookmarks', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // Test that addressBookmarksGlobal is initialized
    const initialGlobalBookmarks = await client.evaluate(() => {
      return window.store.addressBookmarksGlobal.length
    })
    expect(initialGlobalBookmarks).toEqual(0)

    // Test adding a global bookmark programmatically
    await client.evaluate(() => {
      window.store.addAddressBookmark({
        addr: '/test/global/path',
        host: 'test-host',
        isGlobal: true,
        id: 'test-global-1'
      })
    })

    // Verify global bookmark was added
    const globalBookmarks = await client.evaluate(() => {
      return window.store.addressBookmarksGlobal
    })
    expect(globalBookmarks.length).toEqual(1)
    expect(globalBookmarks[0].addr).toEqual('/test/global/path')
    expect(globalBookmarks[0].isGlobal).toEqual(true)

    // Test adding a host-specific bookmark
    await client.evaluate(() => {
      window.store.addAddressBookmark({
        addr: '/test/host/path',
        host: 'test-host',
        isGlobal: false,
        id: 'test-host-1'
      })
    })

    // Verify host-specific bookmark was added to correct array
    const hostBookmarks = await client.evaluate(() => {
      return window.store.addressBookmarks
    })
    expect(hostBookmarks.length).toEqual(1)
    expect(hostBookmarks[0].addr).toEqual('/test/host/path')
    expect(hostBookmarks[0].isGlobal).toEqual(false)

    // Test listAddressBookmark includes both types
    const allBookmarks = await client.evaluate(() => {
      return window.store.listAddressBookmark()
    })
    expect(allBookmarks.length).toEqual(2)

    // Test deleting global bookmark
    await client.evaluate(() => {
      window.store.delAddressBookmark({
        id: 'test-global-1'
      })
    })

    const remainingGlobalBookmarks = await client.evaluate(() => {
      return window.store.addressBookmarksGlobal.length
    })
    expect(remainingGlobalBookmarks).toEqual(0)

    await electronApp.close().catch(console.log)
  })
})