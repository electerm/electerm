const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('assert/strict')
const path = require('path')
const fs = require('fs')

const { downloadPackage } = require('../../src/app/lib/npm')

const testFolder = path.join(__dirname, 'npm-test-modules')

describe('npm', () => {
  beforeEach(() => {
    if (fs.existsSync(testFolder)) {
      fs.rmSync(testFolder, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(testFolder)) {
      fs.rmSync(testFolder, { recursive: true, force: true })
    }
  })

  test('should download a simple package from npm', async () => {
    const pkgPath = await downloadPackage('lodash', testFolder)
    assert.ok(fs.existsSync(pkgPath))
    assert.ok(fs.existsSync(path.join(pkgPath, 'package.json')))
    const lodash = require(path.join(pkgPath, 'lodash.js'))
    assert.ok(lodash.clone)
    assert.ok(lodash.without)
  })

  test('should return cached path if package already exists', async () => {
    const firstPath = await downloadPackage('lodash', testFolder)
    const secondPath = await downloadPackage('lodash', testFolder)
    assert.strictEqual(firstPath, secondPath)
  })

  test('should download a package with dependencies', async () => {
    const pkgPath = await downloadPackage('debug', testFolder)
    assert.ok(fs.existsSync(pkgPath))
    assert.ok(fs.existsSync(path.join(pkgPath, 'package.json')))
  })

  test('should throw error for non-existent package', async () => {
    await assert.rejects(
      async () => {
        await downloadPackage('this-package-does-not-exist-12345', testFolder)
      },
      (err) => {
        return err.message.includes('this-package-does-not-exist-12345') || err.code === 'ENOTFOUND'
      }
    )
  })

  test('should download ftp-srv package with dependencies', async () => {
    const pkgPath = await downloadPackage('ftp-srv', testFolder)
    assert.ok(fs.existsSync(pkgPath))
    assert.ok(fs.existsSync(path.join(pkgPath, 'package.json')))
    const { FtpSrv } = require(pkgPath)
    assert.ok(FtpSrv)
    assert.ok(typeof FtpSrv === 'function')
  })
})
