const {
  test: it, expect
} = require('@playwright/test')
const { describe } = it
const { listWidgets, runWidget, stopWidget, runWidgetFunc } = require('../../src/app/widgets/load-widget')
const fs = require('fs/promises')
const path = require('path')

it.setTimeout(100000)

describe('rename-widget', function () {
  let testDir = null
  let widgetInstance = null

  async function createTestFiles () {
    testDir = path.join(process.cwd(), 'temp-rename-test-' + Date.now())
    await fs.mkdir(testDir)

    // Create test files
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'Content 1')
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'Content 2')
    await fs.writeFile(path.join(testDir, 'file3.jpg'), 'Image content')

    // Create a subdirectory with a file
    const subDir = path.join(testDir, 'subfolder')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'subfile.txt'), 'Sub content')
  }

  async function cleanup () {
    if (widgetInstance) {
      await stopWidget(widgetInstance)
      widgetInstance = null
    }
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch (err) {
        console.error('Cleanup error:', err)
      }
    }
  }

  it.beforeEach(async () => {
    await createTestFiles()
  })

  it.afterEach(async () => {
    await cleanup()
  })

  it('should have rename widget available', async function () {
    const widgets = listWidgets()
    expect(Array.isArray(widgets)).toBe(true)

    const renameWidget = widgets.find(w => w.id === 'rename')
    expect(renameWidget).toBeTruthy()
    expect(renameWidget.info.name).toBe('File Renamer')
  })

  it('should run and stop the rename widget', async function () {
    const result = await runWidget('rename', {})
    expect(result).toBeTruthy()
    expect(result.instanceId).toBeTruthy()

    widgetInstance = result.instanceId

    const stopResult = await stopWidget(widgetInstance)
    expect(stopResult).toBeTruthy()
    expect(stopResult.status).toBe('stopped')
    widgetInstance = null
  })

  it('should rename files with simple pattern', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: testDir,
      template: '{name}-renamed.{ext}',
      fileTypes: '*',
      includeSubfolders: false
    })

    expect(renameResult.success).toBe(true)
    expect(renameResult.totalRenamed).toBe(3) // Should rename 3 files in the main directory

    // Check if files were renamed correctly
    const renamedFiles = await fs.readdir(testDir)
    expect(renamedFiles).toContain('file1-renamed.txt')
    expect(renamedFiles).toContain('file2-renamed.txt')
    expect(renamedFiles).toContain('file3-renamed.jpg')
  })

  it('should rename with sequential numbers', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: testDir,
      template: 'myfile-{n:3}.{ext}',
      fileTypes: '*',
      startNumber: 10,
      includeSubfolders: false
    })

    expect(renameResult.success).toBe(true)

    const renamedFiles = await fs.readdir(testDir)
    expect(renamedFiles).toContain('myfile-010.txt')
    expect(renamedFiles).toContain('myfile-011.txt')
    expect(renamedFiles).toContain('myfile-012.jpg')
  })

  it('should filter by file type', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: testDir,
      template: '{name}-{n}.{ext}',
      fileTypes: 'txt',
      includeSubfolders: false
    })

    expect(renameResult.success).toBe(true)
    expect(renameResult.totalRenamed).toBe(2) // Should only rename .txt files

    const renamedFiles = await fs.readdir(testDir)
    // file3.jpg should remain unchanged
    expect(renamedFiles).toContain('file3.jpg')
  })

  it('should include subfolders when enabled', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: testDir,
      template: '{parent}-{name}-{n}.{ext}',
      fileTypes: '*',
      includeSubfolders: true
    })

    expect(renameResult.success).toBe(true)
    expect(renameResult.totalRenamed).toBe(4) // All files including subfolder file

    // Check subfolder file was renamed
    const subFiles = await fs.readdir(path.join(testDir, 'subfolder'))
    expect(subFiles[0]).toMatch(/subfolder-subfile-\d\.txt/)
  })

  it('should handle template with dates and random', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: testDir,
      template: '{name}-{date}-{random}.{ext}',
      fileTypes: '*',
      includeSubfolders: false
    })

    expect(renameResult.success).toBe(true)

    // Verify that files were renamed with date and random pattern
    const renamedFiles = await fs.readdir(testDir)
    const datePattern = /\d{4}-\d{2}-\d{2}/

    for (const file of renamedFiles) {
      // If it's a directory, skip
      const stats = await fs.stat(path.join(testDir, file))
      if (stats.isDirectory()) continue

      // Each renamed file should have a date pattern and a random substring
      expect(file).toMatch(datePattern)
      expect(file).toMatch(/[a-z0-9]{6}/)
    }
  })

  it('should preserve filename case when enabled', async function () {
    // Create a file with mixed case
    await fs.writeFile(path.join(testDir, 'MixedCase.txt'), 'Mixed case content')

    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: testDir,
      template: '{name}-renamed.{ext}',
      fileTypes: '*',
      preserveCase: true,
      includeSubfolders: false
    })

    expect(renameResult.success).toBe(true)

    const renamedFiles = await fs.readdir(testDir)
    expect(renamedFiles).toContain('MixedCase-renamed.txt')
  })

  it('should handle error when directory does not exist', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const renameResult = await runWidgetFunc(widgetInstance, 'rename', {
      directory: '/path/that/does/not/exist',
      template: '{name}-renamed.{ext}',
      fileTypes: '*'
    })

    expect(renameResult.success).toBe(false)
    expect(renameResult.error).toBeTruthy()
  })

  it('should return widget status', async function () {
    const result = await runWidget('rename', {})
    widgetInstance = result.instanceId

    const status = await runWidgetFunc(widgetInstance, 'getStatus')
    expect(status).toBeTruthy()
    expect(status.status).toBe('running')

    await stopWidget(widgetInstance)
    widgetInstance = null
  })
})
