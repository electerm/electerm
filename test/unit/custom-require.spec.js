const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('assert/strict')
const path = require('path')
const fs = require('fs')

const { customRequire } = require('../../src/app/lib/custom-require')

const testFolder = path.join(__dirname, 'custom-require-test-modules')

describe('customRequire', () => {
  beforeEach(() => {
    process.env.CUSTOM_MODULES_FOLDER_PATH = testFolder
    if (fs.existsSync(testFolder)) {
      fs.rmSync(testFolder, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // if (fs.existsSync(testFolder)) {
    //   fs.rmSync(testFolder, { recursive: true, force: true })
    // }
    delete process.env.CUSTOM_MODULES_FOLDER_PATH
  })

  test('should require a built-in module from nodejs default require', async () => {
    const os = await customRequire('os')
    assert.ok(os.platform)
    assert.ok(os.type)
  })

  test('should require a custom module from customModulesFolderPath when isCustomModule is true', async () => {
    const customModulePath = path.join(testFolder, 'node_modules', 'test-custom-module')
    fs.mkdirSync(customModulePath, { recursive: true })
    fs.writeFileSync(path.join(customModulePath, 'package.json'), JSON.stringify({ name: 'test-custom-module', main: 'index.js' }))
    fs.writeFileSync(path.join(customModulePath, 'index.js'), 'module.exports = { custom: true, value: 123 }')

    const result = await customRequire('test-custom-module', { isCustomModule: true })
    assert.strictEqual(result.custom, true)
    assert.strictEqual(result.value, 123)
  })

  test('should use customModulesFolderPath from options when provided', async () => {
    const customPath = path.join(__dirname, 'custom-test-folder')
    fs.mkdirSync(path.join(customPath, 'node_modules', 'test-custom-module'), { recursive: true })
    fs.writeFileSync(
      path.join(customPath, 'node_modules', 'test-custom-module', 'package.json'),
      JSON.stringify({ name: 'test-custom-module', main: 'index.js' })
    )
    fs.writeFileSync(
      path.join(customPath, 'node_modules', 'test-custom-module', 'index.js'),
      'module.exports = { fromOption: true }'
    )

    const result = await customRequire('test-custom-module', {
      customModulesFolderPath: customPath,
      isCustomModule: true
    })
    assert.strictEqual(result.fromOption, true)

    fs.rmSync(customPath, { recursive: true, force: true })
  })

  test('should throw error when downloadModule is false and module not found', async () => {
    await assert.rejects(
      async () => {
        await customRequire('nonexistent-module-xyz', { downloadModule: false })
      },
      (err) => {
        return err.code === 'MODULE_NOT_FOUND' || err.message.includes('nonexistent-module-xyz')
      }
    )
  })

  test('should download module from npm when not found and downloadModule is true', async () => {
    const result = await customRequire('lodash', { downloadModule: true })
    assert.ok(result.clone)
    assert.ok(result.without)
  })
})
