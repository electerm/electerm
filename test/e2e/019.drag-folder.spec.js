const { _electron: electron } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(10000000)
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')
const {
  setupSftpConnection,
  createFile,
  createFolder,
  deleteItem,
  enterFolder,
  navigateToParentFolder,
  verifyFileExists,
  verifyFileTransfersComplete,
  closeApp
} = require('./common/common')

describe('drag-folder-with-files', function () {
  it('should drag folder with files in both directions', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)
    log('019.drag-folder.spec.js: app launched')

    await setupSftpConnection(client)
    log('019.drag-folder.spec.js: sftp connected')

    const stamp = Date.now()
    const localRoot = `drag-folder-local-root-${stamp}`
    const remoteRoot = `drag-folder-remote-root-${stamp}`
    const localSrcFolder = `local-src-folder-${stamp}`
    const localNestedFolder = `local-nested-folder-${stamp}`
    const localRootFile = `local-root-file-${stamp}.txt`
    const localNestedFile = `local-nested-file-${stamp}.txt`
    const remoteTargetForLocalDrag = `remote-target-folder-${stamp}`

    const remoteSrcFolder = `remote-src-folder-${stamp}`
    const remoteNestedFolder = `remote-nested-folder-${stamp}`
    const remoteRootFile = `remote-root-file-${stamp}.txt`
    const remoteNestedFile = `remote-nested-file-${stamp}.txt`
    const localTargetForRemoteDrag = `local-target-folder-${stamp}`
    const localBasePath = await client.getValue('.session-current .sftp-local-section .sftp-title input')
    const localRootAbsPath = path.resolve(localBasePath, localRoot)

    try {
      // Prepare isolated roots on both sides.
      await createFolder(client, 'local', localRoot)
      await createFolder(client, 'remote', remoteRoot)

      // Build non-empty local source folder.
      await enterFolder(client, 'local', localRoot)
      await createFolder(client, 'local', localSrcFolder)
      await enterFolder(client, 'local', localSrcFolder)
      await createFile(client, 'local', localRootFile)
      await createFolder(client, 'local', localNestedFolder)
      await enterFolder(client, 'local', localNestedFolder)
      await createFile(client, 'local', localNestedFile)
      await navigateToParentFolder(client, 'local')
      await navigateToParentFolder(client, 'local')

      // Build remote target folder for local -> remote drag.
      await enterFolder(client, 'remote', remoteRoot)
      await createFolder(client, 'remote', remoteTargetForLocalDrag)

      // Drag local source folder into remote target folder.
      const localSourceSelector = `.session-current .file-list.local .sftp-item[title="${localSrcFolder}"]`
      const remoteTargetSelector = `.session-current .file-list.remote .sftp-item[title="${remoteTargetForLocalDrag}"]`
      await dragItemToItem(client, localSourceSelector, remoteTargetSelector)

      await delay(8000)
      await verifyFileTransfersComplete(client)

      // Verify local -> remote result and nested content.
      await enterFolder(client, 'remote', remoteTargetForLocalDrag)
      expect(await verifyFileExists(client, 'remote', localSrcFolder)).toBe(true)

      await enterFolder(client, 'remote', localSrcFolder)
      expect(await verifyFileExists(client, 'remote', localRootFile)).toBe(true)
      expect(await verifyFileExists(client, 'remote', localNestedFolder)).toBe(true)

      await enterFolder(client, 'remote', localNestedFolder)
      expect(await verifyFileExists(client, 'remote', localNestedFile)).toBe(true)
      await navigateToParentFolder(client, 'remote')
      await navigateToParentFolder(client, 'remote')
      await navigateToParentFolder(client, 'remote')

      // Build non-empty remote source folder for remote -> local drag.
      await createFolder(client, 'remote', remoteSrcFolder)
      await enterFolder(client, 'remote', remoteSrcFolder)
      await createFile(client, 'remote', remoteRootFile)
      await createFolder(client, 'remote', remoteNestedFolder)
      await enterFolder(client, 'remote', remoteNestedFolder)
      await createFile(client, 'remote', remoteNestedFile)
      await navigateToParentFolder(client, 'remote')
      await navigateToParentFolder(client, 'remote')

      // Build local target folder for remote -> local drag.
      await createFolder(client, 'local', localTargetForRemoteDrag)

      // Drag remote source folder into local target folder.
      const remoteSourceSelector = `.session-current .file-list.remote .sftp-item[title="${remoteSrcFolder}"]`
      const localTargetSelector = `.session-current .file-list.local .sftp-item[title="${localTargetForRemoteDrag}"]`
      await dragItemToItem(client, remoteSourceSelector, localTargetSelector)

      await delay(8000)
      await verifyFileTransfersComplete(client)

      // Verify remote -> local result and nested content.
      await enterFolder(client, 'local', localTargetForRemoteDrag)
      expect(await verifyFileExists(client, 'local', remoteSrcFolder)).toBe(true)

      await enterFolder(client, 'local', remoteSrcFolder)
      expect(await verifyFileExists(client, 'local', remoteRootFile)).toBe(true)
      expect(await verifyFileExists(client, 'local', remoteNestedFolder)).toBe(true)

      await enterFolder(client, 'local', remoteNestedFolder)
      expect(await verifyFileExists(client, 'local', remoteNestedFile)).toBe(true)
    } finally {
      // Always clear local test folder even if assertions fail.
      await safeDeleteRoot(client, 'local', localRoot)
      await forceDeleteLocalPath(localRootAbsPath)
      // Keep remote cleanup as best effort to avoid leaking remote fixtures.
      await safeDeleteRoot(client, 'remote', remoteRoot)
      await closeApp(electronApp, __filename)
      log('019.drag-folder.spec.js: app closed')
    }
  })
})

async function dragItemToItem (client, sourceSelector, targetSelector) {
  const sourceElement = await client.locator(sourceSelector)
  const targetElement = await client.locator(targetSelector)

  const sourceBound = await sourceElement.boundingBox()
  const targetBound = await targetElement.boundingBox()

  expect(!!sourceBound).toBe(true)
  expect(!!targetBound).toBe(true)

  await client.mouse.move(
    sourceBound.x + sourceBound.width / 2,
    sourceBound.y + sourceBound.height / 2
  )
  await client.mouse.down()
  await delay(500)

  await client.mouse.move(
    targetBound.x + targetBound.width / 2,
    targetBound.y + targetBound.height / 2,
    { steps: 20 }
  )
  await delay(500)

  await client.mouse.up()
}

async function ensureItemVisibleAtCurrentOrParent (client, type, itemName, maxHops = 8) {
  const targetSelector = `.session-current .file-list.${type} .sftp-item[title="${itemName}"]`
  for (let i = 0; i <= maxHops; i++) {
    if (await client.elemExist(targetSelector)) {
      return true
    }
    await navigateToParentFolder(client, type)
  }
  throw new Error(`Failed to find ${itemName} in ${type} pane during cleanup`)
}

async function safeDeleteRoot (client, type, itemName) {
  try {
    await ensureItemVisibleAtCurrentOrParent(client, type, itemName)
    await deleteItem(client, type, itemName)
  } catch (e) {
    log(`019.drag-folder.spec.js: cleanup skipped for ${type}/${itemName}: ${e.message}`)
  }
}

async function forceDeleteLocalPath (absPath) {
  try {
    if (!absPath || !fs.existsSync(absPath)) {
      return
    }
    fs.rmSync(absPath, { recursive: true, force: true })
    log(`019.drag-folder.spec.js: force deleted local path ${absPath}`)
  } catch (e) {
    log(`019.drag-folder.spec.js: force delete failed for ${absPath}: ${e.message}`)
  }
}
