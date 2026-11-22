const { after, describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const asar = require('@electron/asar')

const helper = path.resolve(__dirname, '../../build/bin/patch-asar-install-src.js')
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asar-install-src-'))

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(
  entry => entry.isDirectory()
    ? walk(path.join(dir, entry.name))
    : [path.join(dir, entry.name)]
)

function makeArchive (name, installSrc) {
  const src = path.join(tmpDir, `${name}-app`)
  fs.mkdirSync(path.join(src, 'lib'), { recursive: true })
  fs.writeFileSync(path.join(src, 'lib', 'install-src.js'), installSrc)
  fs.writeFileSync(path.join(src, 'index.js'), 'console.log(1)\n')
  const archive = path.join(tmpDir, `${name}.asar`)
  return asar.createPackageFromFiles(src, archive, walk(src)).then(() => archive)
}

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

describe('loong64 asar install-src patch', () => {
  it('patches in place and leaves every other file untouched', async () => {
    const archive = await makeArchive(
      'padded',
      "module.exports = 'linux-loong64.tar.gz'".padEnd(64, ' ')
    )
    const before = asar.listPackage(archive)
    const sizeBefore = fs.statSync(archive).size

    execFileSync(process.execPath, [helper, archive, 'linux-loongarch64.deb'])

    assert.deepStrictEqual(asar.listPackage(archive), before)
    assert.equal(fs.statSync(archive).size, sizeBefore)
    assert.equal(
      asar.extractFile(archive, 'lib/install-src.js').toString().trim(),
      "module.exports = 'linux-loongarch64.deb'"
    )
    assert.equal(
      asar.extractFile(archive, 'index.js').toString(),
      'console.log(1)\n'
    )
  })

  it('fails loudly when the new value does not fit the original slot', async () => {
    const archive = await makeArchive(
      'unpadded',
      "module.exports = 'linux-loong64.tar.gz'"
    )
    assert.throws(() => {
      execFileSync(process.execPath, [helper, archive, 'linux-loongarch64.deb'], {
        stdio: 'pipe'
      })
    })
  })
})
